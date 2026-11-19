import type { Player, TournamentConfig, TournamentState } from '../types/tournament';
import { generateSmartSchedule } from '../utils/scheduler';

export const STORAGE_KEY = 'qingzhuan_pickleball_state_v1';

export const DEMO_PLAYERS: Player[] = [
  { id: 'p1', name: '林叙', gender: 'M', rating: 4.0, active: true, joinedRound: 1 },
  { id: 'p2', name: '陈知夏', gender: 'F', rating: 3.6, active: true, joinedRound: 1 },
  { id: 'p3', name: '周越', gender: 'M', rating: 3.8, active: true, joinedRound: 1 },
  { id: 'p4', name: '苏婉', gender: 'F', rating: 3.4, active: true, joinedRound: 1 },
  { id: 'p5', name: '顾北辰', gender: 'M', rating: 4.1, active: true, joinedRound: 1 },
  { id: 'p6', name: '许清宁', gender: 'F', rating: 3.5, active: true, joinedRound: 1 },
  { id: 'p7', name: '陆明远', gender: 'M', rating: 3.7, active: true, joinedRound: 1 },
  { id: 'p8', name: '江映月', gender: 'F', rating: 3.3, active: true, joinedRound: 1 },
];

export const DEFAULT_CONFIG: TournamentConfig = {
  title: '周六晚 · 滨江八人轻转赛',
  venue: '滨江匹克球公园 1-2号场',
  format: 'classic',
  courtCount: 2,
  totalRounds: 7,
  targetScore: 11,
  winByTwo: true,
  roundMinutes: 12,
};

export function createDemoTournament(): TournamentState {
  const now = Date.now();
  const seed = 202611;
  const players = DEMO_PLAYERS.map((p) => ({ ...p }));
  const rounds = generateSmartSchedule(players, DEFAULT_CONFIG, seed);

  // Pre-fill Round 1 with realistic completed scores so first paint showcases live standings & chemistry
  if (rounds[0] && rounds[0].matches.length >= 2) {
    rounds[0].matches[0] = {
      ...rounds[0].matches[0],
      scoreA: 11,
      scoreB: 8,
      status: 'completed',
      completedAt: now - 1000 * 60 * 14,
    };
    rounds[0].matches[1] = {
      ...rounds[0].matches[1],
      scoreA: 9,
      scoreB: 11,
      status: 'completed',
      completedAt: now - 1000 * 60 * 12,
    };
  }

  return {
    id: 'demo-binjiang-8',
    createdAt: now - 1000 * 60 * 30,
    updatedAt: now,
    seed,
    config: { ...DEFAULT_CONFIG },
    players,
    rounds,
    rosterDirty: false,
  };
}

export function loadTournamentState(): TournamentState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoTournament();
    const parsed = JSON.parse(raw) as TournamentState;
    if (
      !parsed ||
      !parsed.config ||
      !Array.isArray(parsed.players) ||
      !Array.isArray(parsed.rounds)
    ) {
      return createDemoTournament();
    }
    return parsed;
  } catch {
    return createDemoTournament();
  }
}

export function saveTournamentState(state: TournamentState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}
