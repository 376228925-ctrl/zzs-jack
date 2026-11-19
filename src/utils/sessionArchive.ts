import type {
  PersonalMatchRecord,
  Player,
  TournamentConfig,
  TournamentState,
} from '../types/tournament';
import { createDemoTournament, DEMO_PLAYERS } from '../data/demoTournament';
import { generateSmartSchedule } from './scheduler';

const SESSIONS_STORAGE_KEY = 'qingzhuan_calendar_sessions_v1';

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getOffsetDateISO(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDateISO(d);
}

/**
 * Generates a realistic completed historical session for Yesterday so users immediately experience
 * the multi-day calendar history & personal AI career review.
 */
export function createYesterdayHistorySession(): TournamentState {
  const yesterdayStr = getOffsetDateISO(-1);
  const ts = Date.now() - 1000 * 60 * 60 * 24;
  const players: Player[] = [
    { id: 'y1', name: 'Jack', gender: 'M', rating: 4.2, active: true, joinedRound: 1 },
    { id: 'y2', name: '陈知夏', gender: 'F', rating: 3.6, active: true, joinedRound: 1 },
    { id: 'y3', name: '林叙', gender: 'M', rating: 4.0, active: true, joinedRound: 1 },
    { id: 'y4', name: '苏婉', gender: 'F', rating: 3.4, active: true, joinedRound: 1 },
    { id: 'y5', name: '顾北辰', gender: 'M', rating: 4.1, active: true, joinedRound: 1 },
    { id: 'y6', name: '许清宁', gender: 'F', rating: 3.5, active: true, joinedRound: 1 },
    { id: 'y7', name: '周越', gender: 'M', rating: 3.8, active: true, joinedRound: 1 },
    { id: 'y8', name: '江映月', gender: 'F', rating: 3.3, active: true, joinedRound: 1 },
  ];

  const config: TournamentConfig = {
    title: '周五晚 · 海岸灯光热身赛',
    venue: '滨江匹克球公园 1-2号场',
    format: 'balanced',
    courtCount: 2,
    totalRounds: 4,
    targetScore: 11,
    winByTwo: true,
    roundMinutes: 12,
  };

  const rounds = generateSmartSchedule(players, config, 202610);
  const presetScores: Array<[number, number]> = [
    [11, 7],
    [11, 9],
    [8, 11],
    [11, 6],
    [11, 8],
    [9, 11],
    [11, 5],
    [10, 12],
  ];

  let scoreIdx = 0;
  rounds.forEach((r, rIdx) => {
    r.matches.forEach((m) => {
      const [sA, sB] = presetScores[scoreIdx % presetScores.length];
      scoreIdx += 1;
      m.scoreA = sA;
      m.scoreB = sB;
      m.status = 'completed';
      m.completedAt = ts + rIdx * 1000 * 60 * 15;
    });
  });

  return {
    id: `session-yesterday-${yesterdayStr}`,
    sessionDate: yesterdayStr,
    publishedBy: 'Jack',
    createdAt: ts,
    updatedAt: ts + 1000 * 60 * 90,
    seed: 202610,
    config,
    players,
    rounds,
    rosterDirty: false,
  };
}

export function createInitialCalendarSessions(): TournamentState[] {
  const todayStr = getOffsetDateISO(0);
  const todaySession = createDemoTournament();
  todaySession.sessionDate = todayStr;
  todaySession.publishedBy = 'Jack';
  // Include Jack in today's demo session roster? Keep existing 8 players intact for unit tests,
  // while yesterday includes Jack + core club members so Jack's personal history is immediately populated!
  const yesterdaySession = createYesterdayHistorySession();
  return [todaySession, yesterdaySession];
}

export function loadCalendarSessions(): TournamentState[] {
  if (typeof window === 'undefined') return createInitialCalendarSessions();
  try {
    const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) {
      const init = createInitialCalendarSessions();
      window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(init));
      return init;
    }
    const parsed = JSON.parse(raw) as TournamentState[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createInitialCalendarSessions();
    }
    return parsed.map((s) => ({
      ...s,
      sessionDate: s.sessionDate || formatDateISO(new Date(s.createdAt || Date.now())),
    }));
  } catch {
    return createInitialCalendarSessions();
  }
}

export function saveCalendarSessions(sessions: TournamentState[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Creates a brand-new tournament session for a specific calendar date without altering historical sessions.
 */
export function createSessionForDate(params: {
  sessionDate: string;
  config: TournamentConfig;
  players: Player[];
  publishedBy: string;
}): TournamentState {
  const now = Date.now();
  const seed = Math.floor(now % 1000000);
  const basePlayers =
    params.players.length >= 4
      ? params.players.map((p, idx) => ({
          ...p,
          id: `s-${now}-${idx}`,
          active: true,
          joinedRound: 1,
        }))
      : DEMO_PLAYERS.map((p, idx) => ({ ...p, id: `s-${now}-${idx}` }));

  const rounds = generateSmartSchedule(basePlayers, params.config, seed);
  return {
    id: `session-${params.sessionDate}-${now.toString(36)}`,
    sessionDate: params.sessionDate,
    publishedBy: params.publishedBy,
    createdAt: now,
    updatedAt: now,
    seed,
    config: { ...params.config },
    players: basePlayers,
    rounds,
    rosterDirty: false,
  };
}

/**
 * Extracts strictly isolated personal match records for a given player across ALL calendar sessions.
 */
export function extractPersonalHistory(
  sessions: TournamentState[],
  matchNames: string[]
): {
  records: PersonalMatchRecord[];
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  pointDiff: number;
  bestPartner: { name: string; games: number; wins: number; pointDiff: number } | null;
} {
  const targets = new Set(
    matchNames.map((n) => n.trim().toLowerCase()).filter(Boolean)
  );
  if (targets.size === 0) {
    return { records: [], games: 0, wins: 0, losses: 0, winRate: 0, pointDiff: 0, bestPartner: null };
  }

  const records: PersonalMatchRecord[] = [];
  const partnerMap = new Map<string, { games: number; wins: number; pointDiff: number }>();

  for (const session of sessions) {
    const playerMap = new Map(session.players.map((p) => [p.id, p]));
    const myPlayer = session.players.find((p) => targets.has(p.name.trim().toLowerCase()));
    if (!myPlayer) continue;

    for (const round of session.rounds) {
      for (const m of round.matches) {
        if (m.status !== 'completed' || m.scoreA === null || m.scoreB === null) continue;
        const inA = m.teamA.includes(myPlayer.id);
        const inB = m.teamB.includes(myPlayer.id);
        if (!inA && !inB) continue;

        const myTeam = inA ? m.teamA : m.teamB;
        const oppTeam = inA ? m.teamB : m.teamA;
        const myScore = inA ? m.scoreA : m.scoreB;
        const oppScore = inA ? m.scoreB : m.scoreA;
        const partnerId = myTeam[0] === myPlayer.id ? myTeam[1] : myTeam[0];
        const partnerName = playerMap.get(partnerId)?.name ?? '未知搭档';
        const opp1 = playerMap.get(oppTeam[0])?.name ?? '球友';
        const opp2 = playerMap.get(oppTeam[1])?.name ?? '球友';
        const won = myScore > oppScore;
        const diff = myScore - oppScore;

        records.push({
          sessionId: session.id,
          sessionDate: session.sessionDate || formatDateISO(new Date(session.createdAt)),
          sessionTitle: session.config.title,
          venue: session.config.venue,
          roundNumber: m.roundNumber,
          courtNumber: m.courtNumber,
          partnerName,
          opponentNames: [opp1, opp2],
          myScore,
          oppScore,
          won,
          pointDiff: diff,
          completedAt: m.completedAt ?? session.updatedAt,
        });

        const prevP = partnerMap.get(partnerName) ?? { games: 0, wins: 0, pointDiff: 0 };
        prevP.games += 1;
        if (won) prevP.wins += 1;
        prevP.pointDiff += diff;
        partnerMap.set(partnerName, prevP);
      }
    }
  }

  records.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate) || b.completedAt - a.completedAt);

  const games = records.length;
  const wins = records.filter((r) => r.won).length;
  const losses = games - wins;
  const pointDiff = records.reduce((sum, r) => sum + r.pointDiff, 0);
  const winRate = games > 0 ? wins / games : 0;

  let bestPartner: { name: string; games: number; wins: number; pointDiff: number } | null = null;
  for (const [name, stats] of partnerMap.entries()) {
    if (
      !bestPartner ||
      stats.wins > bestPartner.wins ||
      (stats.wins === bestPartner.wins && stats.pointDiff > bestPartner.pointDiff)
    ) {
      bestPartner = { name, ...stats };
    }
  }

  return { records, games, wins, losses, winRate, pointDiff, bestPartner };
}
