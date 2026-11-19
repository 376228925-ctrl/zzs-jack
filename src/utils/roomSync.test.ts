import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  validateTournamentStatePayload,
} from './roomSync';
import { createDemoTournament } from '../data/demoTournament';

test('generateRoomCode returns valid 6-char unambiguous uppercase code', () => {
  const code = generateRoomCode();
  assert.equal(code.length, 6);
  assert.equal(isValidRoomCode(code), true);
  assert.equal(/[01OI]/.test(code), false);
});

test('normalizeRoomCode strips spaces/symbols and uppercases', () => {
  assert.equal(normalizeRoomCode(' pb-8426 '), 'PB8426');
  assert.equal(isValidRoomCode(normalizeRoomCode('pb 84')), true);
  assert.equal(isValidRoomCode(normalizeRoomCode('ab')), false);
});

test('validateTournamentStatePayload accepts valid tournament and rejects malformed objects', () => {
  const valid = createDemoTournament();
  assert.ok(validateTournamentStatePayload(valid));
  assert.equal(validateTournamentStatePayload(null), null);
  assert.equal(validateTournamentStatePayload({ foo: 'bar' }), null);
});
