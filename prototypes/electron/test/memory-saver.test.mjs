import assert from 'node:assert/strict';
import { test } from 'node:test';
import memorySaver from '../dist/main/memory-saver.js';

const { DEFAULT_DISCARD_AFTER_MINUTES, isDiscardAfterMinutes, shouldDiscard } = memorySaver;

const MINUTE = 60_000;
const idle = {
  live: true,
  active: false,
  pinned: false,
  loading: false,
  audible: false,
  devToolsOpen: false,
  edited: false,
  inactiveSince: 0,
};

test('a background tab is discarded once it has been idle long enough', () => {
  assert.equal(shouldDiscard(idle, 30 * MINUTE - 1, 30), false);
  assert.equal(shouldDiscard(idle, 30 * MINUTE, 30), true);
});

test('discarding can be turned off', () => {
  assert.equal(shouldDiscard(idle, 1000 * MINUTE, 0), false);
});

test('tabs the user still relies on are kept in memory', () => {
  const now = 1000 * MINUTE;
  for (const keep of ['active', 'pinned', 'loading', 'audible', 'devToolsOpen', 'edited']) {
    assert.equal(shouldDiscard({ ...idle, [keep]: true }, now, 30), false, keep);
  }
  assert.equal(shouldDiscard({ ...idle, live: false }, now, 30), false);
});

test('only the offered durations are accepted', () => {
  assert.equal(isDiscardAfterMinutes(DEFAULT_DISCARD_AFTER_MINUTES), true);
  assert.equal(isDiscardAfterMinutes(0), true);
  assert.equal(isDiscardAfterMinutes(45), false);
  assert.equal(isDiscardAfterMinutes('30'), false);
});
