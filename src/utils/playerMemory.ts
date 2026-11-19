import type { Player, PlayerCareerRecord, PlayerStanding, Round } from '../types/tournament';

const MEMORY_STORAGE_KEY = 'pickleball_career_memory_v1';

export type CareerMemoryMap = Record<string, PlayerCareerRecord>;

export function normalizePlayerKey(name: string): string {
  return name.trim().toLowerCase();
}

export function loadCareerMemory(): CareerMemoryMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CareerMemoryMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCareerMemory(memory: CareerMemoryMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Ignore storage quota issues
  }
}

/**
 * Pure dynamic skill estimator combining self-reported DUPR with real cross-session match history
 * and current tournament momentum. Clamped safely to [2.0, 5.5].
 */
export function computeDynamicDupr(
  baseDupr: number,
  career: PlayerCareerRecord | undefined,
  currentStanding?: PlayerStanding
): number {
  const histGames = career?.games ?? 0;
  const histWins = career?.wins ?? 0;
  const histDiff = career?.pointDiff ?? 0;

  const curGames = currentStanding?.played ?? 0;
  const curWins = currentStanding?.wins ?? 0;
  const curDiff = currentStanding?.pointDiff ?? 0;

  // Blend historical record with current session performance (avoid double counting if already saved)
  const totalGames = Math.max(histGames, curGames);
  if (totalGames === 0) return Number(baseDupr.toFixed(2));

  const useCareer = histGames >= curGames && histGames > 0;
  const games = useCareer ? histGames : curGames;
  const wins = useCareer ? histWins : curWins;
  const diff = useCareer ? histDiff : curDiff;

  const winRate = wins / games;
  const avgDiff = diff / games;

  // Confidence weight grows with sample size up to 0.55
  const confidence = Math.min(0.55, games * 0.08);
  const delta = (winRate - 0.5) * 0.6 + (avgDiff / 11) * 0.35;
  const adjusted = baseDupr + delta * confidence;
  return Number(Math.max(2.0, Math.min(5.5, adjusted)).toFixed(2));
}

/**
 * Records any newly completed matches from a tournament into persistent player career memory.
 * Deduplicates by tournamentId + matchId so re-saving never double-counts matches.
 */
export function recordCompletedMatchesToMemory(
  prevMemory: CareerMemoryMap,
  tournamentId: string,
  players: Player[],
  rounds: Round[]
): CareerMemoryMap {
  const next: CareerMemoryMap = {};
  for (const [k, v] of Object.entries(prevMemory)) {
    next[k] = {
      ...v,
      recentForm: [...v.recentForm],
      recordedMatchIds: [...v.recordedMatchIds],
    };
  }

  const playerMap = new Map(players.map((p) => [p.id, p]));

  for (const round of rounds) {
    for (const m of round.matches) {
      if (m.status !== 'completed' || m.scoreA === null || m.scoreB === null) continue;
      const matchKey = `${tournamentId}:${m.id}`;
      const scoreA = m.scoreA;
      const scoreB = m.scoreB;

      const applySide = (ids: [string, string], myScore: number, oppScore: number) => {
        const won = myScore > oppScore;
        const diff = myScore - oppScore;
        for (const pid of ids) {
          const p = playerMap.get(pid);
          if (!p) continue;
          const key = normalizePlayerKey(p.name);
          const existing = next[key] ?? {
            name: p.name,
            games: 0,
            wins: 0,
            losses: 0,
            pointDiff: 0,
            estimatedDupr: p.rating,
            recentForm: [],
            recordedMatchIds: [],
            lastPlayedAt: Date.now(),
          };

          if (existing.recordedMatchIds.includes(matchKey)) continue;

          existing.games += 1;
          if (won) existing.wins += 1;
          else if (myScore < oppScore) existing.losses += 1;
          existing.pointDiff += diff;
          existing.recentForm = [...existing.recentForm.slice(-7), won ? 'W' : 'L'];
          existing.recordedMatchIds = [...existing.recordedMatchIds.slice(-99), matchKey];
          existing.lastPlayedAt = m.completedAt ?? Date.now();
          existing.estimatedDupr = computeDynamicDupr(p.rating, existing);
          next[key] = existing;
        }
      };

      applySide(m.teamA, scoreA, scoreB);
      applySide(m.teamB, scoreB, scoreA);
    }
  }

  return next;
}
