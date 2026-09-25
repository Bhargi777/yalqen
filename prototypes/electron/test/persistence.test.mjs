import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import persistence from '../dist/main/persistence.js';

const { SessionStore } = persistence;
const session = (url) => ({ version: 1, activeTabId: null, tabs: [{ id: 'tab', url, title: url, faviconUrl: null, keepAlive: false, history: null }] });

test('frequent changes are coalesced into one background save', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalqen-session-'));
  try {
    const store = new SessionStore(dir);
    let snapshots = 0;
    store.scheduleSave(() => { snapshots++; return session('first'); }, 10);
    store.scheduleSave(() => { snapshots++; return session('latest'); }, 10);
    await waitFor(() => fs.existsSync(path.join(dir, 'tabs.json')));
    assert.equal(snapshots, 1);
    assert.equal(store.load().tabs[0].url, 'latest');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a pending background save cannot replace the final shutdown save', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalqen-session-'));
  const writeFile = fs.promises.writeFile;
  let startWrite;
  let finishWrite;
  let noteWritten;
  const started = new Promise((resolve) => { startWrite = resolve; });
  const released = new Promise((resolve) => { finishWrite = resolve; });
  const written = new Promise((resolve) => { noteWritten = resolve; });
  fs.promises.writeFile = async (...args) => {
    startWrite();
    await released;
    await writeFile(...args);
    noteWritten();
  };
  try {
    const store = new SessionStore(dir);
    store.scheduleSave(() => session('old'), 0);
    await started;
    store.saveNow(session('final'));
    finishWrite();
    await written;
    await waitFor(() => fs.readdirSync(dir).every((file) => !file.endsWith('.tmp')));
    assert.equal(store.load().tabs[0].url, 'final');
  } finally {
    finishWrite();
    fs.promises.writeFile = writeFile;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function waitFor(condition) {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for session save');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
