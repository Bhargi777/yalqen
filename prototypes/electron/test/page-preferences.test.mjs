// Runs against the compiled main-process modules (npm test builds them first).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import preferences from '../dist/main/page-preferences.js';

const { acceptLanguages, fontPreferences, spellCheckerLanguages } = preferences;

test('font sizes follow Chromium steps', () => {
  assert.deepEqual(fontPreferences('medium'), { defaultFontSize: 16, defaultMonospaceFontSize: 13 });
  assert.deepEqual(fontPreferences('xlarge'), { defaultFontSize: 24, defaultMonospaceFontSize: 20 });
  assert.deepEqual(fontPreferences('small'), { defaultFontSize: 12, defaultMonospaceFontSize: 10 });
});

test('languages are ordered by the chosen preference', () => {
  assert.equal(acceptLanguages('tr'), 'tr-TR,tr,en-US,en');
  assert.equal(acceptLanguages('en'), 'en-US,en,tr-TR,tr');
  assert.deepEqual(spellCheckerLanguages('tr'), ['tr', 'en-US']);
  assert.deepEqual(spellCheckerLanguages('en'), ['en-US', 'tr']);
});
