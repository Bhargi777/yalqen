import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import historyModule from '../dist/main/history.js';
import internalPages from '../dist/main/internal-pages.js';

const { HistoryStore } = historyModule;
const { renderHistory } = internalPages;

test('visits survive restart, can be searched, removed, and cleared', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yalqen-history-'));
  try {
    const store = new HistoryStore(directory);
    assert.equal(store.visit('yalqen://newtab/', 'Yeni sekme'), null);
    assert.equal(store.visit('javascript:alert(1)', 'Unsafe'), null);
    const first = store.visit('https://example.com/one', 'İlk sayfa');
    const second = store.visit('https://example.com/two', 'İkinci sayfa');
    assert.ok(first && second);
    store.setTitle(second, 'Güncel başlık');
    store.saveNow();

    const restored = new HistoryStore(directory);
    assert.deepEqual(restored.list().map(({ id }) => id), [second, first]);
    assert.equal(restored.list('GÜNCEL').length, 1);
    assert.equal(restored.list('example.com').length, 2);
    restored.remove(first);
    restored.saveNow();
    assert.deepEqual(new HistoryStore(directory).list().map(({ id }) => id), [second]);
    restored.clear();
    assert.deepEqual(new HistoryStore(directory).list(), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('history page escapes page titles, URLs, and search terms', () => {
  const html = renderHistory([{
    id: 'item',
    url: 'https://example.com/?q="bad"',
    title: '<script>alert(1)</script>',
    visitedAt: Date.now(),
  }], '" autofocus onfocus="alert(1)');
  assert.ok(html.includes('&#60;script&#62;alert(1)&#60;/script&#62;'));
  assert.ok(html.includes('q=&#34;bad&#34;'));
  assert.ok(html.includes('value="&#34; autofocus onfocus=&#34;alert(1)"'));
  assert.ok(!html.includes('<script>'));
});
