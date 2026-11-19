interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  TOURNAMENT_KV?: KVNamespaceLike;
}

interface PagesContext {
  request: Request;
  env: Env;
  params: { code?: string };
}

const ROOM_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeCode(raw?: string): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const code = normalizeCode(context.params.code);
  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    return jsonResponse({ ok: false, error: '无效的赛事房间码' }, 400);
  }

  const kv = context.env.TOURNAMENT_KV;
  if (!kv) {
    return jsonResponse(
      {
        ok: false,
        storageMode: 'local_only',
        error: '当前站点尚未绑定 Cloudflare KV（变量名 TOURNAMENT_KV），默认使用本机存储',
      },
      503
    );
  }

  try {
    const raw = await kv.get(`room:${code}`);
    if (!raw) {
      return jsonResponse({ ok: false, error: `未找到房间 ${code}，请确认组织者已点击同步` }, 404);
    }
    const record = JSON.parse(raw) as { state: unknown; updatedAt: number };
    return jsonResponse({
      ok: true,
      code,
      state: record.state,
      updatedAt: record.updatedAt,
      storageMode: 'cloudflare_kv',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '云端房间读取失败';
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const onRequestPut = async (context: PagesContext): Promise<Response> => {
  const code = normalizeCode(context.params.code);
  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    return jsonResponse({ ok: false, error: '无效的赛事房间码' }, 400);
  }

  const kv = context.env.TOURNAMENT_KV;
  if (!kv) {
    return jsonResponse(
      {
        ok: false,
        storageMode: 'local_only',
        error: '请在 Cloudflare Pages 后台绑定 KV 命名空间 TOURNAMENT_KV 后启用云端多端同步',
      },
      503
    );
  }

  try {
    const body = (await context.request.json()) as { state?: unknown };
    if (!body?.state || typeof body.state !== 'object') {
      return jsonResponse({ ok: false, error: '缺少赛事状态数据' }, 400);
    }

    const updatedAt = Date.now();
    await kv.put(`room:${code}`, JSON.stringify({ state: body.state, updatedAt }), {
      expirationTtl: ROOM_TTL_SECONDS,
    });

    return jsonResponse({
      ok: true,
      code,
      updatedAt,
      storageMode: 'cloudflare_kv',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '云端同步保存失败';
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
