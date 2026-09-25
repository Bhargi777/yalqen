import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ElectronBlocker } from '@ghostery/adblocker-electron';
import adblock from '../dist/main/adblock.js';

const { loadEngine } = adblock;

test('an old filter cache is usable immediately without downloading lists', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalqen-adblock-'));
  const cache = path.join(dir, 'filters.bin');
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  try {
    fs.writeFileSync(cache, ElectronBlocker.empty().serialize());
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fs.utimesSync(cache, old, old);
    globalThis.fetch = async () => { fetches++; throw new Error('network should not be used'); };

    const result = await loadEngine(cache);
    assert.equal(result.stale, true);
    assert.equal(typeof result.blocker.isBlockingEnabled, 'function');
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
