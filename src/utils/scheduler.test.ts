import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeScheduleFairness,
  calculateStandings,
  generateNextMexicanoRound,
  generateSmartSchedule,
  getPlayerScheduleTimeline,
  rescheduleRemainingRounds,
  swapPlayersInRound,
  validateMatchScore,
} from './scheduler';
import type { Player, TournamentConfig, TournamentState } from '../types/tournament';

function makePlayers(count: number): Player[] {
  const ratings = [4.5, 4.2, 4.0, 3.8, 3.6, 3.4, 3.2, 3.0, 2.8, 3.9, 3.5, 3.1];
  return Array.from({ length: count }, (_, idx) => ({
    id: `p${idx + 1}`,
    name: `球员${idx + 1}`,
    gender: idx % 2 === 0 ? 'M' : 'F',
    rating: ratings[idx % ratings.length],
    active: true,
    joinedRound: 1,
  }));
}

test('8-player 2-court 7-round classic schedule has 100% unique partners and balanced counts', () => {
  const players = makePlayers(8);
  const config: TournamentConfig = {
    title: '八人转测试',
    venue: '测试场',
    format: 'classic',
    courtCount: 2,
    totalRounds: 7,
    targetScore: 11,
    winByTwo: true,
    roundMinutes: 12,
  };

  const rounds = generateSmartSchedule(players, config, 12345);
  assert.equal(rounds.length, 7);

  for (const round of rounds) {
    assert.equal(round.matches.length, 2);
    assert.equal(round.restingPlayerIds.length, 0);
    const seen = new Set<string>();
    for (const m of round.matches) {
      for (const pid of [...m.teamA, ...m.teamB]) {
        assert.equal(seen.has(pid), false, `Player ${pid} duplicated in round ${round.roundNumber}`);
        seen.add(pid);
      }
    }
    assert.equal(seen.size, 8);
  }

  const report = analyzeScheduleFairness(players, rounds);
  assert.equal(report.partnerUniquenessPct, 100);
  assert.equal(report.repeatPartnerCount, 0);
  assert.equal(report.playCountSpread, 0);
});

test('9-player 2-court 6-round schedule distributes byes fairly with spread <= 1 and no consecutive byes', () => {
  const players = makePlayers(9);
  const config: TournamentConfig = {
    title: '九人转测试',
    venue: '测试场',
    format: 'classic',
    courtCount: 2,
    totalRounds: 6,
    targetScore: 11,
    winByTwo: true,
    roundMinutes: 12,
  };

  const rounds = generateSmartSchedule(players, config, 777);
  assert.equal(rounds.length, 6);

  let prevBye: string | null = null;
  for (const round of rounds) {
    assert.equal(round.restingPlayerIds.length, 1);
    const curBye = round.restingPlayerIds[0];
    assert.notEqual(curBye, prevBye, 'No player should rest two rounds in a row');
    prevBye = curBye;
  }

  const report = analyzeScheduleFairness(players, rounds);
  assert.ok(report.playCountSpread <= 1, `Expected spread <= 1, got ${report.playCountSpread}`);
});

test('balanced mode produces low average DUPR gap across matches', () => {
  const players = makePlayers(8);
  const config: TournamentConfig = {
    title: '水平均衡转',
    venue: '测试场',
    format: 'balanced',
    courtCount: 2,
    totalRounds: 6,
    targetScore: 11,
    winByTwo: true,
    roundMinutes: 12,
  };

  const rounds = generateSmartSchedule(players, config, 42);
  const report = analyzeScheduleFairness(players, rounds);
  assert.ok(report.avgSkillGap <= 0.35, `Expected avgSkillGap <= 0.35, got ${report.avgSkillGap}`);
});

test('mixed mode prioritizes male+female pairings when gender is balanced', () => {
  const players = makePlayers(8); // 4M, 4F
  const config: TournamentConfig = {
    title: '混双优选转',
    venue: '测试场',
    format: 'mixed',
    courtCount: 2,
    totalRounds: 5,
    targetScore: 11,
    winByTwo: true,
    roundMinutes: 12,
  };

  const rounds = generateSmartSchedule(players, config, 88);
  const report = analyzeScheduleFairness(players, rounds);
  assert.ok(report.mixedTeamPct >= 80, `Expected mixedTeamPct >= 80, got ${report.mixedTeamPct}`);
});

test('standings sort correctly by wins -> winRate -> pointDiff -> pointsFor', () => {
  const players = makePlayers(4);
  const rounds = [
    {
      roundNumber: 1,
      restingPlayerIds: [],
      generatedMode: 'classic' as const,
      matches: [
        {
          id: 'r1-c1',
          roundNumber: 1,
          courtNumber: 1,
          teamA: ['p1', 'p2'] as [string, string],
          teamB: ['p3', 'p4'] as [string, string],
          scoreA: 11,
          scoreB: 5,
          status: 'completed' as const,
        },
      ],
    },
    {
      roundNumber: 2,
      restingPlayerIds: [],
      generatedMode: 'classic' as const,
      matches: [
        {
          id: 'r2-c1',
          roundNumber: 2,
          courtNumber: 1,
          teamA: ['p1', 'p3'] as [string, string],
          teamB: ['p2', 'p4'] as [string, string],
          scoreA: 11,
          scoreB: 9,
          status: 'completed' as const,
        },
      ],
    },
  ];

  const standings = calculateStandings(players, rounds);
  assert.equal(standings[0].player.id, 'p1');
  assert.equal(standings[0].wins, 2);
  assert.equal(standings[0].pointDiff, 8);
  // p2 and p3 both have 1 win, 1 loss. p2 diff = +6 - 2 = +4, p3 diff = -6 + 2 = -4
  assert.equal(standings[1].player.id, 'p2');
  assert.equal(standings[1].pointDiff, 4);
  assert.equal(standings[2].player.id, 'p3');
  assert.equal(standings[2].pointDiff, -4);
  assert.equal(standings[3].player.id, 'p4');
  assert.equal(standings[3].wins, 0);
});

test('mexicano next round seeds top 4 ranked players onto Court 1', () => {
  const players = makePlayers(8);
  const config: TournamentConfig = {
    title: '胜者升场测试',
    venue: '测试场',
    format: 'mexicano',
    courtCount: 2,
    totalRounds: 5,
    targetScore: 11,
    winByTwo: true,
    roundMinutes: 12,
  };

  const round1 = generateSmartSchedule(players, config, 10)[0];
  // Complete round 1 matches
  round1.matches[0].scoreA = 11;
  round1.matches[0].scoreB = 3;
  round1.matches[0].status = 'completed';
  round1.matches[1].scoreA = 11;
  round1.matches[1].scoreB = 6;
  round1.matches[1].status = 'completed';

  const standings = calculateStandings(players, [round1]);
  const top4Ids = new Set(standings.slice(0, 4).map((s) => s.player.id));

  const round2 = generateNextMexicanoRound(players, [round1], config, 10);
  const court1Players = new Set([...round2.matches[0].teamA, ...round2.matches[0].teamB]);
  assert.deepEqual(court1Players, top4Ids);
});

test('rescheduleRemainingRounds preserves completed rounds and excludes paused players from future rounds', () => {
  const players = makePlayers(8);
  const config: TournamentConfig = {
    title: '中途调整测试',
    venue: '测试场',
    format: 'classic',
    courtCount: 2,
    totalRounds: 5,
    targetScore: 11,
    winByTwo: true,
    roundMinutes: 12,
  };

  const rounds = generateSmartSchedule(players, config, 11);
  rounds[0].matches[0].scoreA = 11;
  rounds[0].matches[0].scoreB = 7;
  rounds[0].matches[0].status = 'completed';

  // Pause p8 and add p9
  const updatedPlayers: Player[] = [
    ...players.map((p) => (p.id === 'p8' ? { ...p, active: false } : p)),
    { id: 'p9', name: '新球友', gender: 'M', rating: 3.6, active: true, joinedRound: 2 },
  ];

  const state: TournamentState = {
    id: 'test-1',
    createdAt: 0,
    updatedAt: 0,
    seed: 11,
    config,
    players: updatedPlayers,
    rounds,
    rosterDirty: true,
  };

  const rescheduled = rescheduleRemainingRounds(state);
  assert.equal(rescheduled.rosterDirty, false);
  assert.equal(rescheduled.rounds[0].matches[0].scoreA, 11);

  for (const r of rescheduled.rounds.slice(1)) {
    const allIds = [...r.restingPlayerIds, ...r.matches.flatMap((m) => [...m.teamA, ...m.teamB])];
    assert.equal(allIds.includes('p8'), false, 'Paused player p8 must not appear in future rounds');
    assert.equal(allIds.includes('p9'), true, 'New player p9 must appear in future rounds');
  }
});

test('swapPlayersInRound swaps two players cleanly across courts', () => {
  const players = makePlayers(8);
  const rounds = generateSmartSchedule(players, {
    title: '换人测试',
    venue: '',
    format: 'classic',
    courtCount: 2,
    totalRounds: 1,
    targetScore: 11,
    winByTwo: true,
    roundMinutes: 12,
  });

  const r1 = rounds[0];
  const a = r1.matches[0].teamA[0];
  const b = r1.matches[1].teamB[1];
  const swapped = swapPlayersInRound(r1, a, b);

  assert.equal(swapped.matches[0].teamA[0], b);
  assert.equal(swapped.matches[1].teamB[1], a);
});

test('validateMatchScore rejects draws and warns on win-by-two', () => {
  assert.equal(validateMatchScore(11, 11, 11, true).valid, false);
  assert.equal(validateMatchScore(0, 0, 11, true).valid, false);

  const ok = validateMatchScore(11, 9, 11, true);
  assert.equal(ok.valid, true);
  assert.equal(ok.winner, 'A');
  assert.equal(ok.warning, null);

  const warn = validateMatchScore(11, 10, 11, true);
  assert.equal(warn.valid, true);
  assert.ok(warn.warning !== null);
});

test('getPlayerScheduleTimeline tracks personal court, partner, score, and resting rounds', () => {
  const players = makePlayers(5);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const rounds = [
    {
      roundNumber: 1,
      restingPlayerIds: ['p5'],
      generatedMode: 'classic' as const,
      matches: [
        {
          id: 'r1-c1',
          roundNumber: 1,
          courtNumber: 1,
          teamA: ['p1', 'p2'] as [string, string],
          teamB: ['p3', 'p4'] as [string, string],
          scoreA: 11,
          scoreB: 6,
          status: 'completed' as const,
        },
      ],
    },
    {
      roundNumber: 2,
      restingPlayerIds: ['p1'],
      generatedMode: 'classic' as const,
      matches: [
        {
          id: 'r2-c1',
          roundNumber: 2,
          courtNumber: 1,
          teamA: ['p2', 'p3'] as [string, string],
          teamB: ['p4', 'p5'] as [string, string],
          scoreA: null,
          scoreB: null,
          status: 'pending' as const,
        },
      ],
    },
  ];

  const p1Timeline = getPlayerScheduleTimeline('p1', rounds, playerMap);
  assert.equal(p1Timeline.length, 2);
  assert.equal(p1Timeline[0].status, 'win');
  assert.equal(p1Timeline[0].partnerName, '球员2');
  assert.equal(p1Timeline[0].myScore, 11);
  assert.equal(p1Timeline[0].oppScore, 6);
  assert.equal(p1Timeline[1].status, 'resting');
  assert.equal(p1Timeline[1].courtNumber, null);
});

