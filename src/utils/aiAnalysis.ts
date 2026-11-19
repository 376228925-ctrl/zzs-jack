import type {
  AiMatchmakeGoal,
  Match,
  Player,
  PlayerStanding,
  ScheduleFairnessReport,
  TournamentState,
} from '../types/tournament';
import {
  computeDynamicDupr,
  normalizePlayerKey,
  type CareerMemoryMap,
} from './playerMemory';

export type AnalysisRequestType =
  | 'tournament'
  | 'player'
  | 'match'
  | 'matchmake'
  | 'calibrate'
  | 'poster_copy'
  | 'career_review';

export interface TournamentAnalysisResult {
  headline: string;
  mvpComment: string;
  darkHorse: string;
  chemistryHighlight: string;
  tacticalTips: string[];
  groupSummary: string;
}

export interface PlayerScoutResult {
  summary: string;
  strength: string;
  improvement: string;
  bestPartnerAdvice: string;
}

export interface MatchPreviewResult {
  winProbA: number;
  winProbB: number;
  keyMatchup: string;
  teamATip: string;
  teamBTip: string;
}

export interface AiMatchmakeCourtPlan {
  courtNumber: number;
  teamA: [string, string];
  teamB: [string, string];
  storyline: string;
}

export interface AiMatchmakeResult {
  strategySummary: string;
  courts: AiMatchmakeCourtPlan[];
  restingIds: string[];
}

export interface PlayerCalibrationItem {
  playerId: string;
  name: string;
  currentDupr: number;
  suggestedDupr: number;
  reason: string;
}

export interface CalibrationResult {
  summary: string;
  adjustments: PlayerCalibrationItem[];
}

export interface PosterCopyResult {
  coverTitle: string;
  coverSub: string;
  mvpQuote: string;
}

export interface CareerReviewResult {
  archetype: string;
  headline: string;
  trendAnalysis: string;
  strengths: string;
  blindSpots: string;
  nextSessionPlan: string[];
}

export interface AnalyzeApiPayload {
  type: AnalysisRequestType;
  context: Record<string, unknown>;
}

export interface AnalyzeApiResponse<T = unknown> {
  ok: boolean;
  model?: string;
  data?: T;
  error?: string;
}

const GOAL_DESC: Record<AiMatchmakeGoal, string> = {
  balanced_clash: '旗鼓相当巅峰对决：优先平衡每场双方真实战力，尽量减少重复搭档',
  carry_mix: '强弱带飞教学局：高分球手带低分球友组队，保证场均实力均衡且社交感强',
  rematch_rivalry: '强强对话与复仇局：让连胜高手拆队正面交锋，制造最有看点的焦点场',
  mixed_priority: '混双社交优选：优先促成男女混双组合，同时兼顾双方胜率平衡',
};

export function buildTournamentAnalysisPayload(
  state: TournamentState,
  standings: PlayerStanding[],
  fairness: ScheduleFairnessReport
): Record<string, unknown> {
  const completedMatches = state.rounds.flatMap((r) =>
    r.matches
      .filter((m) => m.status === 'completed' && m.scoreA !== null && m.scoreB !== null)
      .map((m) => {
        const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
        return {
          round: m.roundNumber,
          court: m.courtNumber,
          teamA: [nameOf(m.teamA[0]), nameOf(m.teamA[1])],
          teamB: [nameOf(m.teamB[0]), nameOf(m.teamB[1])],
          score: `${m.scoreA}:${m.scoreB}`,
        };
      })
  );

  return {
    title: state.config.title,
    venue: state.config.venue,
    format: state.config.format,
    targetScore: state.config.targetScore,
    completedCount: completedMatches.length,
    totalCount: state.rounds.reduce((sum, r) => sum + r.matches.length, 0),
    fairness: {
      partnerUniquenessPct: fairness.partnerUniquenessPct,
      avgSkillGap: fairness.avgSkillGap,
      compositeScore: fairness.compositeScore,
    },
    standings: standings.map((s) => ({
      rank: s.rank,
      name: s.player.name,
      gender: s.player.gender,
      dupr: s.player.rating,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      pointDiff: s.pointDiff,
      avgPointsFor: Number(s.avgPointsFor.toFixed(1)),
      bestPartner: s.bestPartner?.partnerName ?? null,
    })),
    recentMatches: completedMatches.slice(-12),
  };
}

export function buildPlayerScoutPayload(
  standing: PlayerStanding,
  state: TournamentState
): Record<string, unknown> {
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  const playerMatches = state.rounds.flatMap((r) =>
    r.matches
      .filter(
        (m) =>
          m.status === 'completed' &&
          (m.teamA.includes(standing.player.id) || m.teamB.includes(standing.player.id))
      )
      .map((m) => {
        const inA = m.teamA.includes(standing.player.id);
        const myTeam = inA ? m.teamA : m.teamB;
        const oppTeam = inA ? m.teamB : m.teamA;
        const partnerId = myTeam[0] === standing.player.id ? myTeam[1] : myTeam[0];
        return {
          round: m.roundNumber,
          partner: nameOf(partnerId),
          opponents: [nameOf(oppTeam[0]), nameOf(oppTeam[1])],
          myScore: inA ? m.scoreA : m.scoreB,
          oppScore: inA ? m.scoreB : m.scoreA,
        };
      })
  );

  return {
    tournamentTitle: state.config.title,
    targetScore: state.config.targetScore,
    player: {
      name: standing.player.name,
      rank: standing.rank,
      dupr: standing.player.rating,
      wins: standing.wins,
      losses: standing.losses,
      pointDiff: standing.pointDiff,
      avgPointsFor: Number(standing.avgPointsFor.toFixed(1)),
      partnerRecords: standing.partnerRecords.slice(0, 5),
    },
    matches: playerMatches,
  };
}

export function buildMatchPreviewPayload(
  match: Match,
  playerMap: Map<string, Player>,
  standings: PlayerStanding[],
  targetScore: number
): Record<string, unknown> {
  const standingMap = new Map(standings.map((s) => [s.player.id, s]));
  const serializePlayer = (id: string) => {
    const p = playerMap.get(id);
    const s = standingMap.get(id);
    return {
      name: p?.name ?? '球友',
      gender: p?.gender ?? 'U',
      dupr: p?.rating ?? 3.5,
      rank: s?.rank ?? null,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      pointDiff: s?.pointDiff ?? 0,
    };
  };

  return {
    roundNumber: match.roundNumber,
    courtNumber: match.courtNumber,
    targetScore,
    teamA: [serializePlayer(match.teamA[0]), serializePlayer(match.teamA[1])],
    teamB: [serializePlayer(match.teamB[0]), serializePlayer(match.teamB[1])],
  };
}

/**
 * Builds rich historical + current-session matchmaking payload for DeepSeek AI Tournament Director.
 */
export function buildAiMatchmakePayload(
  state: TournamentState,
  standings: PlayerStanding[],
  careerMemory: CareerMemoryMap,
  targetRoundNumber: number,
  goal: AiMatchmakeGoal
): Record<string, unknown> {
  const standingMap = new Map(standings.map((s) => [s.player.id, s]));
  const activePlayers = state.players.filter((p) => p.active);
  const effectiveCourts = Math.min(state.config.courtCount, Math.floor(activePlayers.length / 4));

  // Track past partner pairs & rest counts from previous rounds
  const pastPartnerPairs: string[] = [];
  const restCounts: Record<string, number> = {};
  activePlayers.forEach((p) => {
    restCounts[p.id] = 0;
  });

  state.rounds
    .filter((r) => r.roundNumber < targetRoundNumber)
    .forEach((r) => {
      r.restingPlayerIds.forEach((pid) => {
        if (restCounts[pid] !== undefined) restCounts[pid] += 1;
      });
      r.matches.forEach((m) => {
        pastPartnerPairs.push(`${m.teamA[0]}+${m.teamA[1]}`, `${m.teamB[0]}+${m.teamB[1]}`);
      });
    });

  return {
    targetRoundNumber,
    courtCount: effectiveCourts,
    goal,
    goalDescription: GOAL_DESC[goal],
    players: activePlayers.map((p) => {
      const s = standingMap.get(p.id);
      const career = careerMemory[normalizePlayerKey(p.name)];
      return {
        id: p.id,
        name: p.name,
        gender: p.gender,
        declaredDupr: p.rating,
        dynamicDupr: computeDynamicDupr(p.rating, career, s),
        todayWins: s?.wins ?? 0,
        todayLosses: s?.losses ?? 0,
        todayPointDiff: s?.pointDiff ?? 0,
        careerGames: career?.games ?? 0,
        careerWinRate: career && career.games > 0 ? Math.round((career.wins / career.games) * 100) : null,
        recentForm: career?.recentForm?.slice(-4) ?? s?.form?.slice(-4) ?? [],
        restedSoFar: restCounts[p.id] ?? 0,
      };
    }),
    pastPartnerPairs: pastPartnerPairs.slice(-24),
  };
}

/**
 * Strictly validates DeepSeek's proposed court assignments so no player ID is duplicated,
 * missing, or hallucinated. Returns null if invalid so UI can show a clean retry notice.
 */
export function validateAiMatchmakeResult(
  raw: AiMatchmakeResult,
  activePlayerIds: string[],
  courtCount: number
): AiMatchmakeResult | null {
  if (!raw || !Array.isArray(raw.courts) || raw.courts.length !== courtCount) return null;
  const activeSet = new Set(activePlayerIds);
  const used = new Set<string>();
  const normalizedCourts: AiMatchmakeCourtPlan[] = [];

  for (let i = 0; i < raw.courts.length; i++) {
    const c = raw.courts[i];
    if (!c || !Array.isArray(c.teamA) || !Array.isArray(c.teamB)) return null;
    if (c.teamA.length !== 2 || c.teamB.length !== 2) return null;
    const four = [c.teamA[0], c.teamA[1], c.teamB[0], c.teamB[1]];
    for (const id of four) {
      if (typeof id !== 'string' || !activeSet.has(id) || used.has(id)) {
        return null;
      }
      used.add(id);
    }
    normalizedCourts.push({
      courtNumber: i + 1,
      teamA: [c.teamA[0], c.teamA[1]],
      teamB: [c.teamB[0], c.teamB[1]],
      storyline: typeof c.storyline === 'string' && c.storyline.trim() ? c.storyline.trim() : 'AI 动态均衡对阵',
    });
  }

  const restingIds = activePlayerIds.filter((id) => !used.has(id));
  return {
    strategySummary:
      typeof raw.strategySummary === 'string' && raw.strategySummary.trim()
        ? raw.strategySummary.trim()
        : 'DeepSeek 已结合历史战绩与本场手感完成动态优化排阵',
    courts: normalizedCourts,
    restingIds,
  };
}

export function buildCalibrationPayload(
  state: TournamentState,
  standings: PlayerStanding[],
  careerMemory: CareerMemoryMap
): Record<string, unknown> {
  return {
    tournamentTitle: state.config.title,
    players: standings.map((s) => {
      const career = careerMemory[normalizePlayerKey(s.player.name)];
      return {
        playerId: s.player.id,
        name: s.player.name,
        declaredDupr: s.player.rating,
        dynamicEstimate: computeDynamicDupr(s.player.rating, career, s),
        todayRecord: `${s.wins}胜${s.losses}负 (净胜${s.pointDiff})`,
        careerGames: career?.games ?? 0,
        careerDiff: career?.pointDiff ?? 0,
      };
    }),
  };
}

export function buildPosterCopyPayload(
  state: TournamentState,
  standings: PlayerStanding[],
  fairness: ScheduleFairnessReport
): Record<string, unknown> {
  const mvp = standings[0];
  return {
    title: state.config.title,
    venue: state.config.venue,
    mvp: mvp
      ? {
          name: mvp.player.name,
          wins: mvp.wins,
          losses: mvp.losses,
          pointDiff: mvp.pointDiff,
          bestPartner: mvp.bestPartner?.partnerName ?? null,
        }
      : null,
    runnerUp: standings[1]?.player.name ?? null,
    partnerUniquenessPct: fairness.partnerUniquenessPct,
  };
}

export function buildCareerReviewPayload(params: {
  displayName: string;
  dupr: number;
  playStyle: string;
  handedness: 'right' | 'left';
  games: number;
  wins: number;
  losses: number;
  pointDiff: number;
  bestPartner: { name: string; games: number; wins: number; pointDiff: number } | null;
  recentMatches: Array<{
    sessionDate: string;
    sessionTitle: string;
    partnerName: string;
    opponentNames: [string, string];
    myScore: number;
    oppScore: number;
    won: boolean;
  }>;
}): Record<string, unknown> {
  return {
    player: {
      name: params.displayName,
      dupr: params.dupr,
      playStyle: params.playStyle,
      handedness: params.handedness === 'left' ? '左手持拍' : '右手持拍',
    },
    careerTotals: {
      games: params.games,
      wins: params.wins,
      losses: params.losses,
      winRatePct: params.games > 0 ? Math.round((params.wins / params.games) * 100) : 0,
      pointDiff: params.pointDiff,
      bestPartner: params.bestPartner,
    },
    recentMatches: params.recentMatches.slice(0, 15),
  };
}

export function buildDeepSeekMessages(
  type: AnalysisRequestType,
  context: Record<string, unknown>
): Array<{ role: 'system' | 'user'; content: string }> {
  const systemBase =
    '你是资深匹克球（Pickleball）赛事总监兼职业球评，擅长用精准、克制、富有大满贯杂志质感的中文输出结构化数据。严格基于输入数据与准确 player id，绝不编造不存在的 ID 或比分。必须且只能返回合法 JSON 对象，不要包含额外解释文字。';

  if (type === 'tournament') {
    return [
      { role: 'system', content: systemBase },
      {
        role: 'user',
        content: `请基于以下匹克球转转赛实时数据，输出严格 JSON：
{
  "headline": "一句20字以内有张力的赛事总评标题",
  "mvpComment": "对当前榜首/MVP的40-60字精准点评",
  "darkHorse": "结合DUPR评分与战绩，点评表现最亮眼的黑马或潜力股（35-55字）",
  "chemistryHighlight": "点评当前最有默契或最值得期待的搭档组合（35-55字）",
  "tacticalTips": ["结合当前得分与分差给出的3条具体匹克球技战术建议（每条18-30字）"],
  "groupSummary": "一段适合直接发到微信球友群的60-90字风趣战报点评"
}
赛事数据：${JSON.stringify(context)}`,
      },
    ];
  }

  if (type === 'player') {
    return [
      { role: 'system', content: systemBase },
      {
        role: 'user',
        content: `请基于以下匹克球球员个人数据，输出严格 JSON 球探报告：
{
  "summary": "一句话概括该球员本场状态与打法风格（20-35字）",
  "strength": "核心优势分析（30-50字）",
  "improvement": "下轮最值得优化的1-2个实战细节（35-55字）",
  "bestPartnerAdvice": "搭档配合与轮转建议（30-45字）"
}
球员数据：${JSON.stringify(context)}`,
      },
    ];
  }

  if (type === 'matchmake') {
    return [
      { role: 'system', content: systemBase },
      {
        role: 'user',
        content: `请作为 AI 赛事总监，结合每位球员的 declaredDupr、基于历史实打战绩算出的 dynamicDupr、近期手感与已搭档记录，为目标轮次排布最精彩的对阵！
硬性规则：
1. courts 数组长度必须严格等于输入中的 courtCount。
2. 每片场地的 teamA 和 teamB 各包含 2 个准确无误的球员 id（必须全部来自输入 players[].id，绝不能重复使用同一个 id）。
3. 尽量避免 pastPartnerPairs 中已经搭档过的组合，同时优先让 restedSoFar 较多的球员上场。
4. 严格遵循 goalDescription 指定的排阵风格。

请只返回严格 JSON：
{
  "strategySummary": "一句话说明本轮 AI 排阵的整体思路（25-45字）",
  "courts": [
    {
      "courtNumber": 1,
      "teamA": ["playerId1", "playerId2"],
      "teamB": ["playerId3", "playerId4"],
      "storyline": "这片场地的核心看点与排阵理由（18-34字）"
    }
  ],
  "restingIds": ["未上场球员id"]
}
输入数据：${JSON.stringify(context)}`,
      },
    ];
  }

  if (type === 'calibrate') {
    return [
      { role: 'system', content: systemBase },
      {
        role: 'user',
        content: `请结合以下球友的自报 DUPR、当前赛况及跨场历史战绩，给出理性的 DUPR 实力分微调建议（单次调整幅度控制在 -0.3 到 +0.3 之间，保留1位小数），用于下一次转转赛更精准排阵。
只返回严格 JSON：
{
  "summary": "一句25字以内的整体实力分布评价",
  "adjustments": [
    {
      "playerId": "准确id",
      "name": "球员姓名",
      "currentDupr": 3.5,
      "suggestedDupr": 3.7,
      "reason": "15-28字简明校准理由"
    }
  ]
}
输入数据：${JSON.stringify(context)}`,
      },
    ];
  }

  if (type === 'poster_copy') {
    return [
      { role: 'system', content: systemBase },
      {
        role: 'user',
        content: `请为一场高端夜场匹克球赛事战报海报撰写杂志封面级中文文案（高级、克制、有体育画报张力，绝不土味）。
只返回严格 JSON：
{
  "coverTitle": "8-14字极具气场的中文大标题",
  "coverSub": "14-24字杂志副标题",
  "mvpQuote": "18-30字写给本场MVP的高级评语"
}
赛事数据：${JSON.stringify(context)}`,
      },
    ];
  }

  if (type === 'career_review') {
    return [
      { role: 'system', content: systemBase },
      {
        role: 'user',
        content: `请基于以下匹克球球员跨日期的个人历史局战绩，撰写一份深度、专业且有温度的个人 AI 生涯复盘报告。
只返回严格 JSON：
{
  "archetype": "4-8字专属球手画像称号（如：网前节奏掌控者）",
  "headline": "16-24字阶段复盘总评",
  "trendAnalysis": "结合跨日期胜负与分差走势的状态分析（45-70字）",
  "strengths": "从搭档胜率与关键分表现提炼出的核心优势（35-55字）",
  "blindSpots": "最需要警惕的失分场景或短板（35-55字）",
  "nextSessionPlan": ["下次上场可立刻执行的3条专项训练或战术目标（每条16-28字）"]
}
个人历史战绩：${JSON.stringify(context)}`,
      },
    ];
  }

  return [
    { role: 'system', content: systemBase },
    {
      role: 'user',
      content: `请基于以下匹克球双打单场对阵，输出严格 JSON 赛前战术预测：
{
  "winProbA": 整数(30-70，代表A队胜率百分比，且 winProbA + winProbB = 100),
  "winProbB": 整数(30-70，代表B队胜率百分比),
  "keyMatchup": "本场胜负手与核心看点（30-50字）",
  "teamATip": "给A队的实战战术锦囊（25-45字）",
  "teamBTip": "给B队的实战战术锦囊（25-45字）"
}
对阵数据：${JSON.stringify(context)}`,
    },
  ];
}

export function parseModelJsonResponse<T>(rawContent: string): T {
  const trimmed = rawContent.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    }
    throw new Error('模型返回格式解析失败');
  }
}
