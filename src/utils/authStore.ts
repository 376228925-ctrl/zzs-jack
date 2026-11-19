import type { Gender, UserAccount, UserRole } from '../types/tournament';

const USERS_STORAGE_KEY = 'qingzhuan_users_v1';
const SESSION_USER_KEY = 'qingzhuan_active_user_id_v1';
const PASSWORD_SALT = 'qingzhuan_pickleball_rbac_v1::';

/**
 * Pure synchronous SHA-256 implementation (zero external deps, works offline in China & Cloudflare Workers).
 */
export function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const W = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        ((W[i - 15] >>> 7) | (W[i - 15] << 25)) ^
        ((W[i - 15] >>> 18) | (W[i - 15] << 14)) ^
        (W[i - 15] >>> 3);
      const s1 =
        ((W[i - 2] >>> 17) | (W[i - 2] << 15)) ^
        ((W[i - 2] >>> 19) | (W[i - 2] << 13)) ^
        (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return H.map((n) => n.toString(16).padStart(8, '0')).join('');
}

export function hashPassword(username: string, rawPassword: string): string {
  return sha256Hex(`${PASSWORD_SALT}${username.trim().toLowerCase()}:${rawPassword}`);
}

export function createSeedUsers(): UserAccount[] {
  const now = Date.now();
  return [
    {
      id: 'u-super-jack',
      username: 'Jack',
      passwordHash: '19bc90c2451197c9b0f93a8c1ba172f93413fc2953ad03ad3d96f2b63b0baedb',
      role: 'super_admin',
      displayName: 'Jack',
      gender: 'M',
      dupr: 4.2,
      handedness: 'right',
      playStyle: '全场攻防 · 网前压迫',
      bio: '俱乐部主理人 · 超级管理员',
      createdAt: now - 1000 * 60 * 60 * 24 * 30,
    },
    {
      id: 'u-club-linxu',
      username: 'linxu',
      passwordHash: '61837b0fe89fa4442cc4f2af43e0f0958e6b9980831dcf2142dd5e081299dab7',
      role: 'admin',
      displayName: '林叙',
      gender: 'M',
      dupr: 4.0,
      handedness: 'right',
      playStyle: '三拍吊球 · 稳定衔接',
      bio: '滨江夜场常驻赛事组织者',
      createdAt: now - 1000 * 60 * 60 * 24 * 14,
    },
    {
      id: 'u-club-zhixia',
      username: 'zhixia',
      passwordHash: '3c2f0f2bab0d7418d49fb901ef22e846db620901c6c451b578450f7984021b28',
      role: 'member',
      displayName: '陈知夏',
      gender: 'F',
      dupr: 3.6,
      handedness: 'right',
      playStyle: '细腻丁克 · 反手防守',
      bio: '周末固定转转赛球友',
      createdAt: now - 1000 * 60 * 60 * 24 * 10,
    },
    {
      id: 'u-club-beichen',
      username: 'beichen',
      passwordHash: '27de683b6b1e732a17c8f78be094cd785c050d547dde9b696de9a94d6b34fefc',
      role: 'member',
      displayName: '顾北辰',
      gender: 'M',
      dupr: 4.1,
      handedness: 'left',
      playStyle: '左手抽球 · 暴力正拍',
      bio: '夜场连胜收割机',
      createdAt: now - 1000 * 60 * 60 * 24 * 7,
    },
  ];
}

export function loadUsers(): UserAccount[] {
  const seeds = createSeedUsers();
  if (typeof window === 'undefined') return seeds;
  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    const parsed = JSON.parse(raw) as UserAccount[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seeds;
    // Always ensure super admin Jack exists
    if (!parsed.some((u) => u.username.toLowerCase() === 'jack')) {
      return [seeds[0], ...parsed];
    }
    return parsed;
  } catch {
    return seeds;
  }
}

export function saveUsers(users: UserAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadActiveUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SESSION_USER_KEY);
  } catch {
    return null;
  }
}

export function saveActiveUserId(userId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!userId) {
      window.localStorage.removeItem(SESSION_USER_KEY);
    } else {
      window.localStorage.setItem(SESSION_USER_KEY, userId);
    }
  } catch {
    // Ignore storage errors
  }
}

export function authenticateUser(
  users: UserAccount[],
  username: string,
  password: string
): { ok: true; user: UserAccount } | { ok: false; error: string } {
  const trimmedUser = username.trim();
  if (!trimmedUser || !password) {
    return { ok: false, error: '请输入账号和密码' };
  }
  const found = users.find((u) => u.username.toLowerCase() === trimmedUser.toLowerCase());
  if (!found) {
    return { ok: false, error: '账号不存在，请先注册或检查输入' };
  }
  const expected = hashPassword(found.username, password);
  if (found.passwordHash !== expected) {
    return { ok: false, error: '密码不正确，请重新输入' };
  }
  return { ok: true, user: found };
}

export function registerNewAccount(
  users: UserAccount[],
  input: {
    username: string;
    password: string;
    displayName: string;
    gender: Gender;
    dupr: number;
    role?: UserRole;
  }
): { ok: true; user: UserAccount; nextUsers: UserAccount[] } | { ok: false; error: string } {
  const username = input.username.trim();
  const displayName = input.displayName.trim() || username;
  if (username.length < 2 || username.length > 20) {
    return { ok: false, error: '账号长度需在 2–20 位之间' };
  }
  if (input.password.length < 6) {
    return { ok: false, error: '密码长度至少 6 位' };
  }
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: `账号「${username}」已被注册` };
  }

  const newUser: UserAccount = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    username,
    passwordHash: hashPassword(username, input.password),
    role: input.role ?? 'member',
    displayName,
    gender: input.gender,
    dupr: Math.max(2.0, Math.min(6.0, Number(input.dupr.toFixed(1)))),
    handedness: 'right',
    playStyle: '均衡全能型',
    bio: '热爱匹克球转转赛',
    createdAt: Date.now(),
  };

  return { ok: true, user: newUser, nextUsers: [...users, newUser] };
}

export function updateUserRoleByAdmin(
  users: UserAccount[],
  actor: UserAccount | null,
  targetUserId: string,
  nextRole: 'admin' | 'member'
): { ok: true; nextUsers: UserAccount[] } | { ok: false; error: string } {
  if (!actor || actor.role !== 'super_admin') {
    return { ok: false, error: '仅超级管理员可调整管理员权限' };
  }
  const target = users.find((u) => u.id === targetUserId);
  if (!target) {
    return { ok: false, error: '未找到目标用户' };
  }
  if (target.role === 'super_admin') {
    return { ok: false, error: '超级管理员权限不可降级' };
  }
  return {
    ok: true,
    nextUsers: users.map((u) => (u.id === targetUserId ? { ...u, role: nextRole } : u)),
  };
}

export function canPublishTournament(user: UserAccount | null): boolean {
  return user?.role === 'super_admin' || user?.role === 'admin';
}

export function canManageAdmins(user: UserAccount | null): boolean {
  return user?.role === 'super_admin';
}

export function getRoleLabel(role: UserRole): string {
  if (role === 'super_admin') return '超级管理员';
  if (role === 'admin') return '赛事管理员';
  return '认证球友';
}
