// Runs against the compiled main-process modules (npm test builds them first).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import settings from '../dist/main/settings.js';

const { SettingsStore, sanitizeSettings } = settings;

test('unknown or mistyped fields fall back', () => {
  assert.deepEqual(
    sanitizeSettings({
      searchEngine: 'altavista',
      theme: 'blue',
      startupBehavior: 'close-all',
      panelCollapsed: 'yes',
      panelSide: 'top',
      freezeBackgroundTabs: 1,
      adBlocking: 'no',
      httpsOnly: 'yes',
      secureDns: 'opendns',
    }),
    {
      version: 1,
      searchEngine: 'google',
      customSearchTemplate: null,
      theme: 'light',
      startupBehavior: 'restore',
      panelCollapsed: false,
      panelSide: 'left',
      freezeBackgroundTabs: true,
      adBlocking: true,
      httpsOnly: false,
      secureDns: 'automatic',
      welcomeCompleted: false,
    },
  );
  assert.equal(sanitizeSettings(null).searchEngine, 'google');
  assert.equal(sanitizeSettings({ customSearchTemplate: '  ' }).customSearchTemplate, null);
});

test('updates keep valid fields and persist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalqen-settings-'));
  try {
    const store = new SettingsStore(dir);
    store.update({
      searchEngine: 'yandex',
      theme: 'dark',
      startupBehavior: 'new-tab',
      panelCollapsed: true,
      panelSide: 'right',
      freezeBackgroundTabs: false,
      adBlocking: false,
      httpsOnly: true,
      secureDns: 'quad9',
    });
    store.update({ searchEngine: 'nope', theme: 7 });
    assert.equal(store.get().searchEngine, 'yandex');
    assert.equal(store.get().theme, 'dark');

    const reloaded = new SettingsStore(dir).get();
    assert.equal(reloaded.searchEngine, 'yandex');
    assert.equal(reloaded.startupBehavior, 'new-tab');
    assert.equal(reloaded.panelCollapsed, true);
    assert.equal(reloaded.panelSide, 'right');
    assert.equal(reloaded.freezeBackgroundTabs, false);
    assert.equal(reloaded.adBlocking, false);
    assert.equal(reloaded.httpsOnly, true);
    assert.equal(reloaded.secureDns, 'quad9');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
