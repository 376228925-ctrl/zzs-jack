import type {
  Match,
  PartnerRecord,
  Player,
  PlayerStanding,
  Round,
  ScheduleFairnessReport,
  ScoreValidationResult,
  ScoringTarget,
  TournamentConfig,
  TournamentFormat,
  TournamentState,
} from '../types/tournament';

/**
 * Deterministic PRNG (Mulberry32) so schedules are reproducible and testable.
 */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Exact Whist tournament W_8 schedule:
 * 8 players, 7 rounds, 2 courts per round.
 * Every player partners with every other player exactly once (0 repeat partners),
 * and faces every other player as opponent exactly twice.
 */
const WHIST_8_TEMPLATE: Array<Array<[[number, number], [number, number]]>> = [
  [
    [[0, 1], [2, 3]],
    [[4, 5], [6, 7]],
  ],
  [
    [[0, 2], [4, 6]],
    [[1, 3], [5, 7]],
  ],
  [
    [[0, 3], [5, 6]],
    [[1, 2], [4, 7]],
  ],
  [
    [[0, 4], [1, 7]],
    [[2, 5], [3, 6]],
  ],
  [
    [[0, 5], [2, 4]],
    [[1, 6], [3, 7]],
  ],
  [
    [[0, 6], [3, 5]],
    [[1, 4], [2, 7]],
  ],
  [
    [[0, 7], [2, 6]],
    [[1, 5], [3, 4]],
  ],
];

interface HistoryMatrix {
  partnerCounts: Map<string, number>;
  opponentCounts: Map<string, number>;
  playCounts: Map<string, number>;
  byeCounts: Map<string, number>;
  lastByeRound: Map<string, number>;
}

function buildHistoryFromRounds(players: Player[], rounds: Round[]): HistoryMatrix {
  const partnerCounts = new Map<string, number>();
  const opponentCounts = new Map<string, number>();
  const playCounts = new Map<string, number>();
  const byeCounts = new Map<string, number>();
  const lastByeRound = new Map<string, number>();

  for (const p of players) {
    playCounts.set(p.id, 0);
    byeCounts.set(p.id, 0);
    lastByeRound.set(p.id, -1);
  }

  for (const round of rounds) {
    for (const pid of round.restingPlayerIds) {
      byeCounts.set(pid, (byeCounts.get(pid) ?? 0) + 1);
      lastByeRound.set(pid, round.roundNumber);
    }

    for (const match of round.matches) {
      const [a1, a2] = match.teamA;
      const [b1, b2] = match.teamB;

      const pkA = pairKey(a1, a2);
      const pkB = pairKey(b1, b2);
      partnerCounts.set(pkA, (partnerCounts.get(pkA) ?? 0) + 1);
      partnerCounts.set(pkB, (partnerCounts.get(pkB) ?? 0) + 1);

      for (const a of match.teamA) {
        playCounts.set(a, (playCounts.get(a) ?? 0) + 1);
        for (const b of match.teamB) {
          const ok = pairKey(a, b);
          opponentCounts.set(ok, (opponentCounts.get(ok) ?? 0) + 1);
        }
      }
      for (const b of match.teamB) {
        playCounts.set(b, (playCounts.get(b) ?? 0) + 1);
      }
    }
  }

  return { partnerCounts, opponentCounts, playCounts, byeCounts, lastByeRound };
}

function recordRoundIntoHistory(history: HistoryMatrix, round: Round): void {
  for (const pid of round.restingPlayerIds) {
    history.byeCounts.set(pid, (history.byeCounts.get(pid) ?? 0) + 1);
    history.lastByeRound.set(pid, round.roundNumber);
  }

  for (const match of round.matches) {
    const [a1, a2] = match.teamA;
    const [b1, b2] = match.teamB;

    const pkA = pairKey(a1, a2);
    const pkB = pairKey(b1, b2);
    history.partnerCounts.set(pkA, (history.partnerCounts.get(pkA) ?? 0) + 1);
    history.partnerCounts.set(pkB, (history.partnerCounts.get(pkB) ?? 0) + 1);

    for (const a of match.teamA) {
      history.playCounts.set(a, (history.playCounts.get(a) ?? 0) + 1);
      for (const b of match.teamB) {
        const ok = pairKey(a, b);
        history.opponentCounts.set(ok, (history.opponentCounts.get(ok) ?? 0) + 1);
      }
    }
    for (const b of match.teamB) {
      history.playCounts.set(b, (history.playCounts.get(b) ?? 0) + 1);
    }
  }
}

function isMixedTeam(p1: Player, p2: Player): boolean {
  return (p1.gender === 'M' && p2.gender === 'F') || (p1.gender === 'F' && p2.gender === 'M');
}

function scoreMatchCandidate(
  teamA: [Player, Player],
  teamB: [Player, Player],
  history: HistoryMatrix,
  format: TournamentFormat
): number {
  let cost = 0;

  // 1. Partner uniqueness penalty (heaviest objective in rotating mixers)
  const pCountA = history.partnerCounts.get(pairKey(teamA[0].id, teamA[1].id)) ?? 0;
  const pCountB = history.partnerCounts.get(pairKey(teamB[0].id, teamB[1].id)) ?? 0;
  cost += pCountA * pCountA * 180 + pCountA * 120;
  cost += pCountB * pCountB * 180 + pCountB * 120;

  // 2. Opponent diversity penalty
  for (const a of teamA) {
    for (const b of teamB) {
      const oCount = history.opponentCounts.get(pairKey(a.id, b.id)) ?? 0;
      cost += oCount * oCount * 16 + oCount * 12;
    }
  }

  // 3. Skill rating balance (DUPR average difference between Team A and Team B)
  const avgA = (teamA[0].rating + teamA[1].rating) / 2;
  const avgB = (teamB[0].rating + teamB[1].rating) / 2;
  const teamDiff = Math.abs(avgA - avgB);

  // Also avoid extreme internal partner gaps in balanced mode so games feel competitive
  const internalGapA = Math.abs(teamA[0].rating - teamA[1].rating);
  const internalGapB = Math.abs(teamB[0].rating - teamB[1].rating);

  if (format === 'balanced') {
    cost += teamDiff * 140 + teamDiff * teamDiff * 90;
    cost += (internalGapA + internalGapB) * 14;
  } else if (format === 'classic') {
    cost += teamDiff * 18;
  } else if (format === 'mixed') {
    cost += teamDiff * 24;
  }

  // 4. Mixed doubles preference
  if (format === 'mixed') {
    const mixedA = isMixedTeam(teamA[0], teamA[1]);
    const mixedB = isMixedTeam(teamB[0], teamB[1]);
    if (!mixedA) cost += 75;
    if (!mixedB) cost += 75;
    // If neither team is mixed, prefer same-gender symmetry (MM vs MM or FF vs FF) over MM vs FF
    if (!mixedA && !mixedB) {
      const aMale = teamA[0].gender === 'M' && teamA[1].gender === 'M';
      const bMale = teamB[0].gender === 'M' && teamB[1].gender === 'M';
      const aFemale = teamA[0].gender === 'F' && teamA[1].gender === 'F';
      const bFemale = teamB[0].gender === 'F' && teamB[1].gender === 'F';
      if ((aMale && bFemale) || (aFemale && bMale)) {
        cost += 95;
      }
    }
  }

  return cost;
}

/**
 * Given 4 players on a court, evaluate all 3 unique 2v2 partitions and return the best one.
 */
function bestPartitionForFour(
  four: [Player, Player, Player, Player],
  history: HistoryMatrix,
  format: TournamentFormat
): { teamA: [Player, Player]; teamB: [Player, Player]; cost: number } {
  const [p0, p1, p2, p3] = four;
  const options: Array<[[Player, Player], [Player, Player]]> = [
    [[p0, p1], [p2, p3]],
    [[p0, p2], [p1, p3]],
    [[p0, p3], [p1, p2]],
  ];

  let best = options[0];
  let bestCost = Number.POSITIVE_INFINITY;

  for (const [teamA, teamB] of options) {
    const cost = scoreMatchCandidate(teamA, teamB, history, format);
    if (cost < bestCost) {
      bestCost = cost;
      best = [teamA, teamB];
    }
  }

  return { teamA: best[0], teamB: best[1], cost: bestCost };
}

/**
 * Select which players play this round vs rest (轮空) fairly:
 * - Prioritize players with fewest games played so far
 * - Strongly avoid consecutive byes (resting two rounds in a row)
 * - Break ties with deterministic RNG
 */
function selectPlayersForRound(
  activePlayers: Player[],
  slotsNeeded: number,
  roundNumber: number,
  history: HistoryMatrix,
  rng: () => number
): { playing: Player[]; resting: Player[] } {
  if (slotsNeeded >= activePlayers.length) {
    return { playing: [...activePlayers], resting: [] };
  }

  const scored = activePlayers.map((player) => {
    const played = history.playCounts.get(player.id) ?? 0;
    const lastBye = history.lastByeRound.get(player.id) ?? -1;
    const restedPreviousRound = lastBye === roundNumber - 1 ? 1 : 0;
    // Lower score = higher priority to PLAY this round
    // Players who rested last round get a strong bonus (-10) so they never sit twice in a row
    const priority = played * 10 - restedPreviousRound * 12 + rng() * 0.5;
    return { player, priority };
  });

  scored.sort((a, b) => a.priority - b.priority);

  const playing = scored.slice(0, slotsNeeded).map((s) => s.player);
  const resting = scored.slice(slotsNeeded).map((s) => s.player);
  return { playing, resting };
}

function optimizeRoundArrangement(
  playing: Player[],
  resting: Player[],
  roundNumber: number,
  history: HistoryMatrix,
  format: TournamentFormat,
  rng: () => number
): Round {
  const courtCount = Math.floor(playing.length / 4);
  if (courtCount === 0) {
    return {
      roundNumber,
      matches: [],
      restingPlayerIds: [...playing, ...resting].map((p) => p.id),
      generatedMode: format,
    };
  }

  // Evaluate multiple candidate groupings of playing players into courts of 4,
  // choosing optimal 2v2 splits for every court.
  const trials = courtCount === 1 ? 1 : Math.min(260, 80 + courtCount * 45);
  let bestMatches: Array<{ teamA: [Player, Player]; teamB: [Player, Player] }> = [];
  let bestTotalCost = Number.POSITIVE_INFINITY;

  for (let t = 0; t < trials; t++) {
    let ordering: Player[];
    if (t === 0 && format === 'balanced') {
      // Seed trial 0 with skill-sorted grouping (similar levels grouped per court)
      ordering = [...playing].sort((a, b) => b.rating - a.rating);
    } else if (t === 1 && format === 'balanced') {
      // Snake draft across courts
      const sorted = [...playing].sort((a, b) => b.rating - a.rating);
      ordering = [];
      for (let c = 0; c < courtCount; c++) {
        ordering.push(
          sorted[c],
          sorted[courtCount * 2 - 1 - c],
          sorted[courtCount * 2 + c],
          sorted[courtCount * 4 - 1 - c]
        );
      }
    } else if (t === 0 && format === 'mixed') {
      // Interleave M and F so every court gets balanced genders
      const males = shuffleWithRng(playing.filter((p) => p.gender === 'M'), rng);
      const females = shuffleWithRng(playing.filter((p) => p.gender === 'F'), rng);
      const others = shuffleWithRng(playing.filter((p) => p.gender === 'U'), rng);
      ordering = [];
      const maxLen = Math.max(males.length, females.length);
      for (let i = 0; i < maxLen; i++) {
        if (males[i]) ordering.push(males[i]);
        if (females[i]) ordering.push(females[i]);
      }
      ordering.push(...others);
    } else {
      ordering = shuffleWithRng(playing, rng);
    }

    let totalCost = 0;
    const candidateMatches: Array<{ teamA: [Player, Player]; teamB: [Player, Player] }> = [];

    for (let c = 0; c < courtCount; c++) {
      const quad = ordering.slice(c * 4, c * 4 + 4) as [Player, Player, Player, Player];
      const split = bestPartitionForFour(quad, history, format);
      totalCost += split.cost;
      candidateMatches.push({ teamA: split.teamA, teamB: split.teamB });
    }

    if (totalCost < bestTotalCost) {
      bestTotalCost = totalCost;
      bestMatches = candidateMatches;
    }
  }

  // Sort courts by average skill descending so Court 1 naturally features the highest-rated matchup
  if (format === 'balanced') {
    bestMatches.sort((m1, m2) => {
      const avg1 = (m1.teamA[0].rating + m1.teamA[1].rating + m1.teamB[0].rating + m1.teamB[1].rating) / 4;
      const avg2 = (m2.teamA[0].rating + m2.teamA[1].rating + m2.teamB[0].rating + m2.teamB[1].rating) / 4;
      return avg2 - avg1;
    });
  }

  const matches: Match[] = bestMatches.map((m, idx) => ({
    id: `r${roundNumber}-c${idx + 1}`,
    roundNumber,
    courtNumber: idx + 1,
    teamA: [m.teamA[0].id, m.teamA[1].id],
    teamB: [m.teamB[0].id, m.teamB[1].id],
    scoreA: null,
    scoreB: null,
    status: 'pending',
  }));

  return {
    roundNumber,
    matches,
    restingPlayerIds: resting.map((p) => p.id),
    generatedMode: format,
  };
}

/**
 * Recommend optimal number of rounds given player & court count.
 */
export function getRecommendedRounds(activePlayerCount: number, courtCount: number): number {
  if (activePlayerCount < 4) return 1;
  const effectiveCourts = Math.min(courtCount, Math.floor(activePlayerCount / 4));
  if (effectiveCourts <= 0) return 1;
  if (activePlayerCount === 8 && effectiveCourts === 2) return 7;
  if (activePlayerCount === 4) return 3;
  if (activePlayerCount === 5) return 5;
  if (activePlayerCount === 6) return 6;
  if (activePlayerCount === 7) return 7;
  if (activePlayerCount === 12 && effectiveCourts === 3) return 7;
  return Math.max(4, Math.min(9, Math.round((activePlayerCount * 3.5) / (effectiveCourts * 4)) + 2));
}

/**
 * Generate a complete smart schedule (or continuation rounds after completed rounds).
 */
export function generateSmartSchedule(
  players: Player[],
  config: TournamentConfig,
  seed: number = 42,
  preservedRounds: Round[] = []
): Round[] {
  const activePlayers = players.filter((p) => p.active);
  const effectiveCourts = Math.min(config.courtCount, Math.floor(activePlayers.length / 4));
  if (effectiveCourts <= 0) {
    return [...preservedRounds];
  }

  const rng = createRng(seed);
  const startRound = preservedRounds.length + 1;

  // Exact Whist W_8 fast-path for classic 8-player, 2-court fresh tournaments
  if (
    config.format === 'classic' &&
    preservedRounds.length === 0 &&
    activePlayers.length === 8 &&
    effectiveCourts === 2 &&
    config.totalRounds <= 7
  ) {
    const permuted = shuffleWithRng(activePlayers, rng);
    const rounds: Round[] = [];
    for (let r = 0; r < config.totalRounds; r++) {
      const template = WHIST_8_TEMPLATE[r];
      const matches: Match[] = template.map(([pairA, pairB], idx) => ({
        id: `r${r + 1}-c${idx + 1}`,
        roundNumber: r + 1,
        courtNumber: idx + 1,
        teamA: [permuted[pairA[0]].id, permuted[pairA[1]].id],
        teamB: [permuted[pairB[0]].id, permuted[pairB[1]].id],
        scoreA: null,
        scoreB: null,
        status: 'pending',
      }));
      rounds.push({
        roundNumber: r + 1,
        matches,
        restingPlayerIds: [],
        generatedMode: 'classic',
      });
    }
    return rounds;
  }

  // Mexicano / Swiss dynamic format generates round-by-round (start with Round 1 if fresh)
  if (config.format === 'mexicano' && preservedRounds.length === 0) {
    const history = buildHistoryFromRounds(players, []);
    const { playing, resting } = selectPlayersForRound(
      activePlayers,
      effectiveCourts * 4,
      1,
      history,
      rng
    );
    const firstRound = optimizeRoundArrangement(playing, resting, 1, history, 'balanced', rng);
    firstRound.generatedMode = 'mexicano';
    return [firstRound];
  }

  const history = buildHistoryFromRounds(players, preservedRounds);
  const rounds: Round[] = [...preservedRounds];
  const slotsPerRound = effectiveCourts * 4;

  for (let roundNum = startRound; roundNum <= config.totalRounds; roundNum++) {
    const { playing, resting } = selectPlayersForRound(
      activePlayers,
      slotsPerRound,
      roundNum,
      history,
      rng
    );
    const round = optimizeRoundArrangement(
      playing,
      resting,
      roundNum,
      history,
      config.format === 'mexicano' || config.format === 'ai_smart' ? 'balanced' : config.format,
      rng
    );
    if (config.format === 'ai_smart') {
      round.generatedMode = 'ai_smart';
    }
    recordRoundIntoHistory(history, round);
    rounds.push(round);
  }

  return rounds;
}

/**
 * Generate the next dynamic Mexicano / Swiss round based on LIVE standings.
 * Court 1 ("王座场") puts Ranks #1+#4 vs #2+#3; Court 2 puts #5+#8 vs #6+#7, etc.,
 * while rotating partners if #1 and #4 already partnered recently.
 */
export function generateNextMexicanoRound(
  players: Player[],
  existingRounds: Round[],
  config: TournamentConfig,
  seed: number = 99
): Round {
  const activePlayers = players.filter((p) => p.active);
  const effectiveCourts = Math.min(config.courtCount, Math.floor(activePlayers.length / 4));
  const nextRoundNum = existingRounds.length + 1;
  const rng = createRng(seed + nextRoundNum * 31);
  const history = buildHistoryFromRounds(players, existingRounds);

  if (effectiveCourts <= 0) {
    return {
      roundNumber: nextRoundNum,
      matches: [],
      restingPlayerIds: activePlayers.map((p) => p.id),
      generatedMode: 'mexicano',
    };
  }

  const standings = calculateStandings(players, existingRounds);
  const rankMap = new Map<string, number>();
  standings.forEach((s) => rankMap.set(s.player.id, s.rank));

  const { playing, resting } = selectPlayersForRound(
    activePlayers,
    effectiveCourts * 4,
    nextRoundNum,
    history,
    rng
  );

  // Order playing players strictly by live standing rank
  const rankedPlaying = [...playing].sort(
    (a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999)
  );

  const matches: Match[] = [];
  for (let c = 0; c < effectiveCourts; c++) {
    const group = rankedPlaying.slice(c * 4, c * 4 + 4) as [Player, Player, Player, Player];
    const [p1, p2, p3, p4] = group;
    // Standard Mexicano pairing is (#1 + #4) vs (#2 + #3), unless repeat partner is heavily penalized
    const primaryA: [Player, Player] = [p1, p4];
    const primaryB: [Player, Player] = [p2, p3];
    const altA: [Player, Player] = [p1, p3];
    const altB: [Player, Player] = [p2, p4];

    const primaryRepeats =
      (history.partnerCounts.get(pairKey(primaryA[0].id, primaryA[1].id)) ?? 0) +
      (history.partnerCounts.get(pairKey(primaryB[0].id, primaryB[1].id)) ?? 0);
    const altRepeats =
      (history.partnerCounts.get(pairKey(altA[0].id, altA[1].id)) ?? 0) +
      (history.partnerCounts.get(pairKey(altB[0].id, altB[1].id)) ?? 0);

    const chosen = altRepeats < primaryRepeats ? { teamA: altA, teamB: altB } : { teamA: primaryA, teamB: primaryB };

    matches.push({
      id: `r${nextRoundNum}-c${c + 1}`,
      roundNumber: nextRoundNum,
      courtNumber: c + 1,
      teamA: [chosen.teamA[0].id, chosen.teamA[1].id],
      teamB: [chosen.teamB[0].id, chosen.teamB[1].id],
      scoreA: null,
      scoreB: null,
      status: 'pending',
    });
  }

  return {
    roundNumber: nextRoundNum,
    matches,
    restingPlayerIds: resting.map((p) => p.id),
    generatedMode: 'mexicano',
  };
}

/**
 * Mid-tournament smart reschedule: keeps all rounds that already have at least one
 * completed match untouched, and re-optimizes all unplayed rounds around currently active players.
 */
export function rescheduleRemainingRounds(state: TournamentState): TournamentState {
  // Find the last round that has any completed match
  let lastLockedIndex = -1;
  state.rounds.forEach((round, idx) => {
    if (round.matches.some((m) => m.status === 'completed')) {
      lastLockedIndex = idx;
    }
  });

  const preservedRounds = lastLockedIndex >= 0 ? state.rounds.slice(0, lastLockedIndex + 1) : [];
  const nextSeed = state.seed + 17;

  if (state.config.format === 'mexicano') {
    const nextRound = generateNextMexicanoRound(state.players, preservedRounds, state.config, nextSeed);
    return {
      ...state,
      seed: nextSeed,
      rounds: [...preservedRounds, nextRound],
      rosterDirty: false,
      updatedAt: Date.now(),
    };
  }

  const targetTotalRounds = Math.max(state.config.totalRounds, preservedRounds.length + 1);
  const newRounds = generateSmartSchedule(
    state.players,
    { ...state.config, totalRounds: targetTotalRounds },
    nextSeed,
    preservedRounds
  );

  return {
    ...state,
    seed: nextSeed,
    config: { ...state.config, totalRounds: targetTotalRounds },
    rounds: newRounds,
    rosterDirty: false,
    updatedAt: Date.now(),
  };
}

/**
 * Swap two players inside a single round (supports court-to-court, within-court, or court-to-resting).
 */
export function swapPlayersInRound(round: Round, playerIdA: string, playerIdB: string): Round {
  if (playerIdA === playerIdB) return round;

  const swapId = (id: string) => {
    if (id === playerIdA) return playerIdB;
    if (id === playerIdB) return playerIdA;
    return id;
  };

  return {
    ...round,
    restingPlayerIds: round.restingPlayerIds.map(swapId),
    matches: round.matches.map((match) => ({
      ...match,
      teamA: [swapId(match.teamA[0]), swapId(match.teamA[1])] as [string, string],
      teamB: [swapId(match.teamB[0]), swapId(match.teamB[1])] as [string, string],
    })),
  };
}

/**
 * Validate match scores against Pickleball scoring rules.
 */
export function validateMatchScore(
  scoreA: number,
  scoreB: number,
  targetScore: ScoringTarget,
  winByTwo: boolean
): ScoreValidationResult {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return { valid: false, error: '比分必须为非负整数', warning: null, winner: null };
  }

  if (scoreA === 0 && scoreB === 0) {
    return { valid: false, error: '请输入有效比分', warning: null, winner: null };
  }

  if (scoreA === scoreB) {
    return { valid: false, error: '匹克球单局不能平局，请分出胜负', warning: null, winner: null };
  }

  const winner: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';
  const high = Math.max(scoreA, scoreB);
  const low = Math.min(scoreA, scoreB);
  const diff = high - low;

  let warning: string | null = null;
  if (high < targetScore) {
    warning = `当前胜方得分 (${high}) 低于设定目标分 ${targetScore} 分（若为限时结算可直接确认）`;
  } else if (winByTwo && diff < 2) {
    warning = `当前规则已开启「净胜2分」，分差为 ${diff} 分（如采用金球制可直接确认）`;
  }

  return { valid: true, error: null, warning, winner };
}

/**
 * Calculate live leaderboard standings with multi-tier Pickleball tie-breakers:
 * 1. Wins desc -> 2. Win rate desc -> 3. Point differential desc -> 4. Points scored desc -> 5. Rating desc
 */
export function calculateStandings(players: Player[], rounds: Round[]): PlayerStanding[] {
  const playerMap = new Map<string, Player>();
  players.forEach((p) => playerMap.set(p.id, p));

  const statsMap = new Map<
    string,
    {
      played: number;
      wins: number;
      losses: number;
      ties: number;
      pointsFor: number;
      pointsAgainst: number;
      form: Array<'W' | 'L' | 'T'>;
      partners: Map<string, { games: number; wins: number; pointDiff: number }>;
    }
  >();

  for (const p of players) {
    statsMap.set(p.id, {
      played: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      form: [],
      partners: new Map(),
    });
  }

  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.status !== 'completed' || match.scoreA === null || match.scoreB === null) {
        continue;
      }

      const sA = match.scoreA;
      const sB = match.scoreB;
      const diffA = sA - sB;
      const resA: 'W' | 'L' | 'T' = sA > sB ? 'W' : sA < sB ? 'L' : 'T';
      const resB: 'W' | 'L' | 'T' = sB > sA ? 'W' : sB < sA ? 'L' : 'T';

      const applyTeam = (
        team: [string, string],
        pf: number,
        pa: number,
        diff: number,
        res: 'W' | 'L' | 'T'
      ) => {
        for (let i = 0; i < 2; i++) {
          const pid = team[i];
          const partnerId = team[1 - i];
          const st = statsMap.get(pid);
          if (!st) continue;
          st.played += 1;
          if (res === 'W') st.wins += 1;
          else if (res === 'L') st.losses += 1;
          else st.ties += 1;
          st.pointsFor += pf;
          st.pointsAgainst += pa;
          st.form.push(res);

          const prevPartner = st.partners.get(partnerId) ?? { games: 0, wins: 0, pointDiff: 0 };
          prevPartner.games += 1;
          if (res === 'W') prevPartner.wins += 1;
          prevPartner.pointDiff += diff;
          st.partners.set(partnerId, prevPartner);
        }
      };

      applyTeam(match.teamA, sA, sB, diffA, resA);
      applyTeam(match.teamB, sB, sA, -diffA, resB);
    }
  }

  const rows: PlayerStanding[] = players.map((player) => {
    const st = statsMap.get(player.id)!;
    const pointDiff = st.pointsFor - st.pointsAgainst;
    const winRate = st.played > 0 ? st.wins / st.played : 0;
    const avgPointsFor = st.played > 0 ? st.pointsFor / st.played : 0;

    const partnerRecords: PartnerRecord[] = Array.from(st.partners.entries())
      .map(([partnerId, rec]) => ({
        partnerId,
        partnerName: playerMap.get(partnerId)?.name ?? '未知球友',
        games: rec.games,
        wins: rec.wins,
        pointDiff: rec.pointDiff,
      }))
      .sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff || b.games - a.games);

    return {
      rank: 0,
      player,
      played: st.played,
      wins: st.wins,
      losses: st.losses,
      ties: st.ties,
      pointsFor: st.pointsFor,
      pointsAgainst: st.pointsAgainst,
      pointDiff,
      winRate,
      avgPointsFor,
      form: st.form.slice(-5),
      partnerRecords,
      bestPartner: partnerRecords.length > 0 ? partnerRecords[0] : null,
    };
  });

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (Math.abs(b.winRate - a.winRate) > 1e-6) return b.winRate - a.winRate;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    if (b.player.rating !== a.player.rating) return b.player.rating - a.player.rating;
    return a.player.name.localeCompare(b.player.name, 'zh-CN');
  });

  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return rows;
}

/**
 * Compute real-time DUPR balance info for a single match.
 */
export function calculateMatchBalance(
  match: Match,
  playerMap: Map<string, Player>
): { avgA: number; avgB: number; gap: number; balancePct: number } {
  const a1 = playerMap.get(match.teamA[0])?.rating ?? 3.5;
  const a2 = playerMap.get(match.teamA[1])?.rating ?? 3.5;
  const b1 = playerMap.get(match.teamB[0])?.rating ?? 3.5;
  const b2 = playerMap.get(match.teamB[1])?.rating ?? 3.5;

  const avgA = Number(((a1 + a2) / 2).toFixed(2));
  const avgB = Number(((b1 + b2) / 2).toFixed(2));
  const gap = Number(Math.abs(avgA - avgB).toFixed(2));
  // 0.00 gap = 100%, 1.00 DUPR gap = 50%
  const balancePct = Math.max(40, Math.min(100, Math.round(100 - gap * 50)));
  return { avgA, avgB, gap, balancePct };
}

/**
 * Analyze fairness & optimization quality of the generated schedule.
 */
export function analyzeScheduleFairness(
  players: Player[],
  rounds: Round[]
): ScheduleFairnessReport {
  const playerMap = new Map<string, Player>();
  players.forEach((p) => playerMap.set(p.id, p));

  const partnerSeen = new Map<string, number>();
  const opponentSeen = new Map<string, number>();
  const playCounts = new Map<string, number>();
  players.filter((p) => p.active).forEach((p) => playCounts.set(p.id, 0));

  let totalMatches = 0;
  let totalTeamPairs = 0;
  let repeatPartnerCount = 0;
  let repeatOpponentCount = 0;
  let skillGapSum = 0;
  let mixedTeamCount = 0;

  for (const round of rounds) {
    for (const match of round.matches) {
      totalMatches += 1;
      totalTeamPairs += 2;

      const pkA = pairKey(match.teamA[0], match.teamA[1]);
      const pkB = pairKey(match.teamB[0], match.teamB[1]);

      if ((partnerSeen.get(pkA) ?? 0) > 0) repeatPartnerCount += 1;
      if ((partnerSeen.get(pkB) ?? 0) > 0) repeatPartnerCount += 1;
      partnerSeen.set(pkA, (partnerSeen.get(pkA) ?? 0) + 1);
      partnerSeen.set(pkB, (partnerSeen.get(pkB) ?? 0) + 1);

      for (const a of match.teamA) {
        if (playCounts.has(a)) playCounts.set(a, (playCounts.get(a) ?? 0) + 1);
        for (const b of match.teamB) {
          const ok = pairKey(a, b);
          if ((opponentSeen.get(ok) ?? 0) > 0) repeatOpponentCount += 1;
          opponentSeen.set(ok, (opponentSeen.get(ok) ?? 0) + 1);
        }
      }
      for (const b of match.teamB) {
        if (playCounts.has(b)) playCounts.set(b, (playCounts.get(b) ?? 0) + 1);
      }

      const bal = calculateMatchBalance(match, playerMap);
      skillGapSum += bal.gap;

      const pa1 = playerMap.get(match.teamA[0]);
      const pa2 = playerMap.get(match.teamA[1]);
      const pb1 = playerMap.get(match.teamB[0]);
      const pb2 = playerMap.get(match.teamB[1]);
      if (pa1 && pa2 && isMixedTeam(pa1, pa2)) mixedTeamCount += 1;
      if (pb1 && pb2 && isMixedTeam(pb1, pb2)) mixedTeamCount += 1;
    }
  }

  const counts = Array.from(playCounts.values());
  const playCountMin = counts.length > 0 ? Math.min(...counts) : 0;
  const playCountMax = counts.length > 0 ? Math.max(...counts) : 0;
  const playCountSpread = playCountMax - playCountMin;

  const partnerUniquenessPct =
    totalTeamPairs > 0
      ? Math.round(((totalTeamPairs - repeatPartnerCount) / totalTeamPairs) * 100)
      : 100;
  const avgSkillGap = totalMatches > 0 ? Number((skillGapSum / totalMatches).toFixed(2)) : 0;
  const mixedTeamPct = totalTeamPairs > 0 ? Math.round((mixedTeamCount / totalTeamPairs) * 100) : 0;

  // Composite fairness score (0-100) based on real schedule metrics
  const spreadPenalty = Math.max(0, playCountSpread - 1) * 18;
  const skillScore = Math.max(0, 100 - avgSkillGap * 45);
  const compositeScore = Math.max(
    50,
    Math.min(100, Math.round(partnerUniquenessPct * 0.55 + skillScore * 0.35 + (100 - spreadPenalty) * 0.1))
  );

  return {
    totalMatches,
    partnerUniquenessPct,
    repeatPartnerCount,
    repeatOpponentCount,
    playCountMin,
    playCountMax,
    playCountSpread,
    avgSkillGap,
    mixedTeamPct,
    compositeScore,
  };
}

/**
 * Format clean Chinese WeChat club summary report ready to paste into a group chat.
 */
export function formatWeChatReport(state: TournamentState, standings: PlayerStanding[]): string {
  const completedMatches = state.rounds.reduce(
    (sum, r) => sum + r.matches.filter((m) => m.status === 'completed').length,
    0
  );
  const totalMatches = state.rounds.reduce((sum, r) => sum + r.matches.length, 0);

  const formatLabels: Record<TournamentFormat, string> = {
    classic: '经典全员转',
    balanced: '水平均衡转',
    mixed: '混双优选转',
    mexicano: '胜者升场制',
    ai_smart: 'AI 智适应排阵',
  };

  const lines: string[] = [
    `【${state.config.title}】实时战报`,
    `场地：${state.config.venue || '未填写'} · ${state.config.courtCount}片场`,
    `赛制：${formatLabels[state.config.format]} · ${state.config.targetScore}分制 · 进度 ${completedMatches}/${totalMatches}场`,
    '——————————————',
  ];

  standings.forEach((s) => {
    const medal = s.rank === 1 ? '冠军' : s.rank === 2 ? '亚军' : s.rank === 3 ? '季军' : `第${s.rank}名`;
    const diffStr = s.pointDiff > 0 ? `+${s.pointDiff}` : `${s.pointDiff}`;
    const winPct = s.played > 0 ? `${Math.round(s.winRate * 100)}%` : '--';
    lines.push(`${medal} ${s.player.name}  ${s.wins}胜${s.losses}负  净胜${diffStr}  胜率${winPct}`);
  });

  if (standings.length > 0 && standings[0].played > 0) {
    const mvp = standings[0];
    lines.push('——————————————');
    lines.push(`本场MVP：${mvp.player.name}（${mvp.wins}胜，净胜分 ${mvp.pointDiff >= 0 ? '+' : ''}${mvp.pointDiff}）`);
    if (mvp.bestPartner) {
      lines.push(`最佳拍档组合：${mvp.player.name} / ${mvp.bestPartner.partnerName}`);
    }
  }

  return lines.join('\n');
}

export interface PlayerRoundTimelineItem {
  roundNumber: number;
  status: 'resting' | 'pending' | 'win' | 'loss';
  courtNumber: number | null;
  matchId: string | null;
  partnerName: string | null;
  opponentNames: [string, string] | null;
  myScore: number | null;
  oppScore: number | null;
}

/**
 * Returns a player's round-by-round personal schedule & match results across the entire tournament.
 */
export function getPlayerScheduleTimeline(
  playerId: string,
  rounds: Round[],
  playerMap: Map<string, Player>
): PlayerRoundTimelineItem[] {
  return rounds.map((round) => {
    for (const match of round.matches) {
      const inA = match.teamA.includes(playerId);
      const inB = match.teamB.includes(playerId);
      if (!inA && !inB) continue;

      const myTeam = inA ? match.teamA : match.teamB;
      const oppTeam = inA ? match.teamB : match.teamA;
      const partnerId = myTeam[0] === playerId ? myTeam[1] : myTeam[0];
      const myScore = inA ? match.scoreA : match.scoreB;
      const oppScore = inA ? match.scoreB : match.scoreA;

      let status: PlayerRoundTimelineItem['status'] = 'pending';
      if (match.status === 'completed' && myScore !== null && oppScore !== null) {
        status = myScore > oppScore ? 'win' : 'loss';
      }

      return {
        roundNumber: round.roundNumber,
        status,
        courtNumber: match.courtNumber,
        matchId: match.id,
        partnerName: playerMap.get(partnerId)?.name ?? '未知球友',
        opponentNames: [
          playerMap.get(oppTeam[0])?.name ?? '球友',
          playerMap.get(oppTeam[1])?.name ?? '球友',
        ],
        myScore,
        oppScore,
      };
    }

    return {
      roundNumber: round.roundNumber,
      status: 'resting',
      courtNumber: null,
      matchId: null,
      partnerName: null,
      opponentNames: null,
      myScore: null,
      oppScore: null,
    };
  });
}

