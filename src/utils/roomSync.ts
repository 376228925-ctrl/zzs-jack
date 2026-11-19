import type { TournamentState } from '../types/tournament';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * ROOM_ALPHABET.length);
    code += ROOM_ALPHABET[idx];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4,8}$/.test(code);
}

export function validateTournamentStatePayload(raw: unknown): TournamentState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<TournamentState>;
  if (!obj.config || typeof obj.config !== 'object') return null;
  if (!Array.isArray(obj.players) || !Array.isArray(obj.rounds)) return null;
  if (typeof obj.config.title !== 'string' || typeof obj.config.courtCount !== 'number') {
    return null;
  }
  return obj as TournamentState;
}

export interface RoomSyncResponse {
  ok: boolean;
  code?: string;
  state?: TournamentState;
  updatedAt?: number;
  storageMode?: 'cloudflare_kv' | 'local_server' | 'local_only';
  error?: string;
}

export async function pushRoomState(
  code: string,
  state: TournamentState
): Promise<RoomSyncResponse> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) {
    return { ok: false, error: '房间码格式无效（需4-8位字母或数字）' };
  }
  const res = await fetch(`/api/rooms/${encodeURIComponent(normalized)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  return (await res.json()) as RoomSyncResponse;
}

export async function pullRoomState(code: string): Promise<RoomSyncResponse> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) {
    return { ok: false, error: '房间码格式无效（需4-8位字母或数字）' };
  }
  const res = await fetch(`/api/rooms/${encodeURIComponent(normalized)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return (await res.json()) as RoomSyncResponse;
}
