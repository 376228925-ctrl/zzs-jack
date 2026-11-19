import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDynamicDupr,
  recordCompletedMatchesToMemory,
} from './playerMemory';
import { createDemoTournament } from '../data/demoTournament';

test('recordCompletedMatchesToMemory records matches once and deduplicates repeat calls', () => {
  const demo = createDemoTournament();
  const mem1 = recordCompletedMatchesToMemory({}, demo.id, demo.players, demo.rounds);
  const gu = mem1['顾北辰'];
  assert.ok(gu);
  assert.equal(gu.games, 1);
  assert.equal(gu.wins, 1);
  assert.equal(gu.pointDiff, 3);

  // Calling again with same tournament does not double count
  const mem2 = recordCompletedMatchesToMemory(mem1, demo.id, demo.players, demo.rounds);
  assert.equal(mem2['顾北辰'].games, 1);
  assert.equal(mem2['顾北辰'].pointDiff, 3);
});

test('computeDynamicDupr lifts strong winners and trims cold streaks within safe bounds', () => {
  const hotDupr = computeDynamicDupr(3.5, {
    name: '江映月',
    games: 5,
    wins: 5,
    losses: 0,
    pointDiff: 22,
    estimatedDupr: 3.5,
    recentForm: ['W', 'W', 'W', 'W', 'W'],
    recordedMatchIds: ['1', '2', '3', '4', '5'],
    lastPlayedAt: Date.now(),
  });
  const coldDupr = computeDynamicDupr(4.0, {
    name: '周越',
    games: 5,
    wins: 0,
    losses: 5,
    pointDiff: -20,
    estimatedDupr: 4.0,
    recentForm: ['L', 'L', 'L', 'L', 'L'],
    recordedMatchIds: ['1', '2', '3', '4', '5'],
    lastPlayedAt: Date.now(),
  });

  assert.ok(hotDupr > 3.5, `Expected hot player rating > 3.5, got ${hotDupr}`);
  assert.ok(coldDupr < 4.0, `Expected cold player rating < 4.0, got ${coldDupr}`);
  assert.ok(hotDupr <= 5.5 && coldDupr >= 2.0);
});
