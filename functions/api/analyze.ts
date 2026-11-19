import {
  buildDeepSeekMessages,
  parseModelJsonResponse,
  type AnalysisRequestType,
} from '../../src/utils/aiAnalysis';

interface Env {
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_BASE_URL?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

async function invokeDeepSeek(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>
) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
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

  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  return { ok: res.ok, status: res.status, text, parsed };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

const ALLOWED_TYPES: AnalysisRequestType[] = [
  'tournament',
  'player',
  'match',
  'matchmake',
  'calibrate',
  'poster_copy',
  'career_review',
];

/**
 * Cloudflare Pages Function: POST /api/analyze
 * Configure secret in Cloudflare Pages dashboard or CLI:
 *   wrangler pages secret put DEEPSEEK_API_KEY
 */
export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const apiKey = context.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { ok: false, error: 'Cloudflare Pages 环境变量尚未配置 DEEPSEEK_API_KEY' },
      500
    );
  }

  let body: { type?: AnalysisRequestType; context?: Record<string, unknown> };
  try {
    body = (await context.request.json()) as {
      type?: AnalysisRequestType;
      context?: Record<string, unknown>;
    };
  } catch {
    return jsonResponse({ ok: false, error: '无效的 JSON 请求体' }, 400);
  }

  if (!body.type || !ALLOWED_TYPES.includes(body.type) || !body.context) {
    return jsonResponse({ ok: false, error: '分析请求参数不完整' }, 400);
  }

  const baseUrl = (context.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(
    /\/+$/,
    ''
  );
  let usedModel = context.env.DEEPSEEK_MODEL || 'deepseek-flash';

  try {
    const messages = buildDeepSeekMessages(body.type, body.context);
    let upstream = await invokeDeepSeek(baseUrl, apiKey, usedModel, messages);

    if (!upstream.ok && (upstream.status === 400 || upstream.status === 404)) {
      const lower = upstream.text.toLowerCase();
      if (lower.includes('model') || lower.includes('not exist') || lower.includes('invalid')) {
        usedModel = 'deepseek-chat';
        upstream = await invokeDeepSeek(baseUrl, apiKey, usedModel, messages);
      }
    }

    if (!upstream.ok || !upstream.parsed) {
      const msg =
        (upstream.parsed?.error as { message?: string } | undefined)?.message ||
        `DeepSeek 上游返回错误 (${upstream.status})`;
      return jsonResponse({ ok: false, error: msg }, 502);
    }

    const choices = upstream.parsed.choices as
      | Array<{ message?: { content?: string } }>
      | undefined;
    const content = choices?.[0]?.message?.content;
    if (!content) {
      return jsonResponse({ ok: false, error: '模型未返回有效内容' }, 502);
    }

    const data = parseModelJsonResponse(content);
    return jsonResponse({ ok: true, model: usedModel, data }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : '分析请求异常';
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
