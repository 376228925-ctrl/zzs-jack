import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildDeepSeekMessages,
  parseModelJsonResponse,
  type AnalysisRequestType,
} from './src/utils/aiAnalysis';

// Load local secrets first (.env.local is gitignored), then fallback to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(
  /\/+$/,
  ''
);
const PRIMARY_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';

async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>
) {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 1100,
      response_format: { type: 'json_object' },
    }),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  return { ok: response.ok, status: response.status, text, parsed };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const ALLOWED_TYPES: AnalysisRequestType[] = [
    'tournament',
    'player',
    'match',
    'matchmake',
    'calibrate',
    'poster_copy',
    'career_review',
  ];

  app.post('/api/analyze', async (req, res) => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        ok: false,
        error: '服务端尚未配置 DEEPSEEK_API_KEY 环境变量',
      });
      return;
    }

    const { type, context } = (req.body ?? {}) as {
      type?: AnalysisRequestType;
      context?: Record<string, unknown>;
    };

    if (!type || !ALLOWED_TYPES.includes(type) || !context) {
      res.status(400).json({ ok: false, error: '分析请求参数不完整' });
      return;
    }

    try {
      const messages = buildDeepSeekMessages(type, context);
      let usedModel = PRIMARY_MODEL;
      let upstream = await callDeepSeek(apiKey, usedModel, messages);

      // Automatic graceful fallback if requested model alias is unavailable on account endpoint
      if (!upstream.ok && (upstream.status === 400 || upstream.status === 404)) {
        const errText = upstream.text.toLowerCase();
        if (errText.includes('model') || errText.includes('not exist') || errText.includes('invalid')) {
          usedModel = 'deepseek-chat';
          upstream = await callDeepSeek(apiKey, usedModel, messages);
        }
      }

      if (!upstream.ok || !upstream.parsed) {
        const msg =
          (upstream.parsed?.error as { message?: string } | undefined)?.message ||
          `DeepSeek 接口返回异常 (${upstream.status})`;
        res.status(502).json({ ok: false, error: msg });
        return;
      }

      const choices = upstream.parsed.choices as
        | Array<{ message?: { content?: string } }>
        | undefined;
      const content = choices?.[0]?.message?.content;
      if (!content) {
        res.status(502).json({ ok: false, error: '大模型未返回有效分析内容' });
        return;
      }

      const data = parseModelJsonResponse(content);
      res.json({ ok: true, model: usedModel, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析服务调用失败';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Local dev room sync store (mirrors Cloudflare Pages KV /functions/api/rooms/[code].ts)
  const roomsFilePath = path.resolve(__dirname, '.data', 'rooms.json');
  const readRoomsStore = (): Record<string, { state: unknown; updatedAt: number }> => {
    try {
      if (!fs.existsSync(roomsFilePath)) return {};
      return JSON.parse(fs.readFileSync(roomsFilePath, 'utf-8')) as Record<
        string,
        { state: unknown; updatedAt: number }
      >;
    } catch {
      return {};
    }
  };
  const writeRoomsStore = (store: Record<string, { state: unknown; updatedAt: number }>) => {
    const dir = path.dirname(roomsFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(roomsFilePath, JSON.stringify(store), 'utf-8');
  };

  app.get('/api/rooms/:code', (req, res) => {
    const code = (req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      res.status(400).json({ ok: false, error: '无效的赛事房间码' });
      return;
    }
    const store = readRoomsStore();
    const record = store[code];
    if (!record) {
      res.status(404).json({ ok: false, error: `未找到房间 ${code}，请确认组织者已点击同步` });
      return;
    }
    res.json({
      ok: true,
      code,
      state: record.state,
      updatedAt: record.updatedAt,
      storageMode: 'local_server',
    });
  });

  app.put('/api/rooms/:code', (req, res) => {
    const code = (req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      res.status(400).json({ ok: false, error: '无效的赛事房间码' });
      return;
    }
    const { state } = (req.body ?? {}) as { state?: unknown };
    if (!state || typeof state !== 'object') {
      res.status(400).json({ ok: false, error: '缺少赛事状态数据' });
      return;
    }
    const store = readRoomsStore();
    const updatedAt = Date.now();
    store[code] = { state, updatedAt };
    writeRoomsStore(store);
    res.json({
      ok: true,
      code,
      updatedAt,
      storageMode: 'local_server',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
