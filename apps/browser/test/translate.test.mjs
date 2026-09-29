import assert from 'node:assert/strict';
import { test } from 'node:test';
import translate from '../dist/main/translate.js';

const { applyScript, chunkTexts, normalizeLanguage, parseCollected, parseTranslation, translatePage, translateTexts } =
  translate;

const reply = (lines, source = 'en') => ({
  ok: true,
  json: async () => [[[lines.join('\n'), 'original', null, null, 1]], null, source],
});

test('texts are grouped by size and count', () => {
  assert.deepEqual(chunkTexts(['a', 'b', 'c']), [[0, 1, 2]]);
  assert.deepEqual(chunkTexts(['x'.repeat(3000), 'y'.repeat(3000)]), [[0], [1]]);
  const many = Array.from({ length: 120 }, () => 'w');
  assert.deepEqual(
    chunkTexts(many).map((chunk) => chunk.length),
    [50, 50, 20],
  );
  assert.deepEqual(chunkTexts([]), []);
});

test('engine responses are joined and their source language read', () => {
  assert.deepEqual(
    parseTranslation([
      [
        ['Merhaba ', 'Hello '],
        ['dünya', 'world'],
      ],
      null,
      'en',
    ]),
    {
      text: 'Merhaba dünya',
      source: 'en',
    },
  );
  assert.equal(parseTranslation('nope'), null);
  assert.equal(parseTranslation([]), null);
  assert.equal(normalizeLanguage('EN'), null);
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage(null), null);
});

test('collected pages are validated', () => {
  assert.deepEqual(parseCollected({ token: 't', texts: ['a'] }), { token: 't', texts: ['a'] });
  assert.equal(parseCollected({ token: 't', texts: [1] }), null);
  assert.equal(parseCollected(null), null);
});

test('a batch maps back to its texts', async () => {
  const requests = [];
  const fetchLike = async (url, init) => {
    requests.push({ url, body: init.body });
    return reply(['Bir', 'İki', 'Üç']);
  };
  const result = await translateTexts(fetchLike, ['One', 'Two', 'Three'], 'tr');
  assert.deepEqual(result, { texts: ['Bir', 'İki', 'Üç'], source: 'en' });
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /tl=tr/);
  assert.equal(requests[0].body, `q=${encodeURIComponent('One\nTwo\nThree')}`);
});

test('a batch the engine reshaped is retried one text at a time', async () => {
  let calls = 0;
  const fetchLike = async (_url, init) => {
    calls++;
    const q = decodeURIComponent(init.body.slice(2));
    return q.includes('\n') ? reply(['Hepsi tek satırda']) : reply([`çeviri:${q}`]);
  };
  const result = await translateTexts(fetchLike, ['a', 'b'], 'tr');
  assert.deepEqual(result.texts, ['çeviri:a', 'çeviri:b']);
  assert.equal(calls, 3);
});

test('a failing engine rejects', async () => {
  await assert.rejects(translateTexts(async () => ({ ok: false, json: async () => null }), ['a'], 'tr'));
});

test('a cancelled run applies nothing', async () => {
  const scripts = [];
  const target = {
    isDestroyed: () => false,
    executeJavaScriptInIsolatedWorld: async (_id, [{ code }]) => {
      scripts.push(code);
      return { token: 'tok', texts: ['Hello'] };
    },
  };
  const result = await translatePage(target, async () => reply(['Merhaba']), 'tr', { cancelled: () => true });
  assert.equal(result, null);
  assert.equal(scripts.length, 1);
});

test('a finished run applies its translations under the page token', async () => {
  const scripts = [];
  const target = {
    isDestroyed: () => false,
    executeJavaScriptInIsolatedWorld: async (_id, [{ code }]) => {
      scripts.push(code);
      return scripts.length === 1 ? { token: 'tok', texts: ['Hello'] } : true;
    },
  };
  const result = await translatePage(target, async () => reply(['Merhaba']), 'tr', { cancelled: () => false });
  assert.deepEqual(result, { source: 'en' });
  assert.equal(scripts[1], applyScript('tok', ['Merhaba']));
});

test('a page with nothing to translate is an error', async () => {
  const target = {
    isDestroyed: () => false,
    executeJavaScriptInIsolatedWorld: async () => ({ token: 'tok', texts: [] }),
  };
  await assert.rejects(translatePage(target, async () => reply([]), 'tr', { cancelled: () => false }));
});
