import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialCalendarSessions,
  createSessionForDate,
  extractPersonalHistory,
  getOffsetDateISO,
} from './sessionArchive';

test('createInitialCalendarSessions provides distinct today and yesterday sessions', () => {
  const sessions = createInitialCalendarSessions();
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].sessionDate, getOffsetDateISO(0));
  assert.equal(sessions[1].sessionDate, getOffsetDateISO(-1));
  assert.ok(sessions[1].rounds.every((r) => r.matches.every((m) => m.status === 'completed')));
});

test('extractPersonalHistory isolates matches strictly by logged-in user name across dates', () => {
  const sessions = createInitialCalendarSessions();
  const jackHist = extractPersonalHistory(sessions, ['Jack']);
  assert.equal(jackHist.games, 4);
  assert.ok(jackHist.records.every((r) => r.sessionDate === getOffsetDateISO(-1)));

  const linxuHist = extractPersonalHistory(sessions, ['林叙']);
  assert.ok(linxuHist.games >= 5); // Played yesterday (4) + today R1 (1)

  const strangerHist = extractPersonalHistory(sessions, ['从未参赛的路人']);
  assert.equal(strangerHist.games, 0);
});

test('createSessionForDate creates a fresh tournament without mutating existing history', () => {
  const sessions = createInitialCalendarSessions();
  const tomorrow = getOffsetDateISO(1);
  const created = createSessionForDate({
    sessionDate: tomorrow,
    config: {
      title: '周日早场 · 海岸进阶局',
      venue: '海滨匹克球俱乐部',
      format: 'ai_smart',
      courtCount: 2,
      totalRounds: 5,
      targetScore: 11,
      winByTwo: true,
      roundMinutes: 12,
    },
    players: sessions[0].players,
    publishedBy: 'Jack',
  });

  assert.equal(created.sessionDate, tomorrow);
  assert.equal(created.publishedBy, 'Jack');
  assert.equal(created.rounds.length, 5);
  assert.equal(created.rounds[0].matches[0].status, 'pending');
});
