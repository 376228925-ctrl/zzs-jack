import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAiMatchmakePayload,
  buildDeepSeekMessages,
  buildTournamentAnalysisPayload,
  parseModelJsonResponse,
  validateAiMatchmakeResult,
} from './aiAnalysis';
import { createDemoTournament } from '../data/demoTournament';
import { analyzeScheduleFairness, calculateStandings } from './scheduler';

test('parseModelJsonResponse parses raw JSON and markdown fenced JSON', () => {
  const plain = parseModelJsonResponse<{ headline: string }>('{"headline":"势均力敌"}');
  assert.equal(plain.headline, '势均力敌');

  const fenced = parseModelJsonResponse<{ winProbA: number; winProbB: number }>(
    '```json\n{"winProbA": 54, "winProbB": 46}\n```'
  );
  assert.equal(fenced.winProbA, 54);
  assert.equal(fenced.winProbB, 46);
});

test('buildTournamentAnalysisPayload includes factual completed matches and standings', () => {
  const demo = createDemoTournament();
  const standings = calculateStandings(demo.players, demo.rounds);
  const fairness = analyzeScheduleFairness(demo.players, demo.rounds);
  const payload = buildTournamentAnalysisPayload(demo, standings, fairness);

  assert.equal(payload.completedCount, 2);
  assert.equal(payload.totalCount, 14);
  assert.equal((payload.standings as unknown[]).length, 8);

  const msgs = buildDeepSeekMessages('tournament', payload);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, 'system');
  assert.ok(msgs[1].content.includes('周六晚'));
});

test('validateAiMatchmakeResult accepts valid unique assignments and computes restingIds', () => {
  const activeIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
  const validated = validateAiMatchmakeResult(
    {
      strategySummary: '一号场强强对话',
      courts: [
        {
          courtNumber: 1,
          teamA: ['p1', 'p4'],
          teamB: ['p2', 'p3'],
          storyline: '历史战绩接近，悬念拉满',
        },
      ],
      restingIds: [],
    },
    activeIds,
    1
  );

  assert.ok(validated);
  assert.deepEqual(validated.restingIds, ['p5']);
  assert.equal(validated.courts[0].storyline, '历史战绩接近，悬念拉满');
});

test('validateAiMatchmakeResult rejects duplicate, hallucinated, or wrong-court payloads', () => {
  const activeIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];

  // Duplicate player p1
  const dup = validateAiMatchmakeResult(
    {
      strategySummary: 'test',
      courts: [
        { courtNumber: 1, teamA: ['p1', 'p2'], teamB: ['p1', 'p4'], storyline: 'bad' },
        { courtNumber: 2, teamA: ['p5', 'p6'], teamB: ['p7', 'p8'], storyline: 'ok' },
      ],
      restingIds: [],
    },
    activeIds,
    2
  );
  assert.equal(dup, null);

  // Unknown hallucinated ID
  const ghost = validateAiMatchmakeResult(
    {
      strategySummary: 'test',
      courts: [
        { courtNumber: 1, teamA: ['p1', 'p2'], teamB: ['p3', 'p999'], storyline: 'bad' },
        { courtNumber: 2, teamA: ['p5', 'p6'], teamB: ['p7', 'p8'], storyline: 'ok' },
      ],
      restingIds: [],
    },
    activeIds,
    2
  );
  assert.equal(ghost, null);

  // Wrong court count
  const wrongCourts = validateAiMatchmakeResult(
    {
      strategySummary: 'test',
      courts: [{ courtNumber: 1, teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], storyline: 'short' }],
      restingIds: [],
    },
    activeIds,
    2
  );
  assert.equal(wrongCourts, null);
});

test('buildAiMatchmakePayload merges dynamic DUPR and past partner pairs', () => {
  const demo = createDemoTournament();
  const standings = calculateStandings(demo.players, demo.rounds);
  const payload = buildAiMatchmakePayload(demo, standings, {}, 2, 'balanced_clash');

  assert.equal(payload.targetRoundNumber, 2);
  assert.equal(payload.courtCount, 2);
  assert.equal((payload.players as unknown[]).length, 8);
  assert.ok((payload.pastPartnerPairs as string[]).length >= 4);
});

