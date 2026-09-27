import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import changeFeed from '../dist/main/change-feed.js';
import downloadsModule from '../dist/main/downloads.js';
import internalPages from '../dist/main/internal-pages.js';
import suggestionModule from '../dist/main/suggestions.js';

const { serveInternalPages } = internalPages;
const { indexHistory, suggest } = suggestionModule;
const page = (name) => path.resolve('src/renderer/public', name);

test('the new tab serves matching local suggestions and its script', async () => {
  let handle;
  const session = { protocol: { handle(_scheme, callback) { handle = callback; } } };
  serveInternalPages(
    session,
    page('newtab.html'),
    page('newtab-suggestions.js'),
    page('history.html'),
    page('downloads.html'),
    page('bookmarks.html'),
    () => [],
    () => [],
    () => [],
    { list: () => [], changes: new changeFeed.ChangeFeed() },
    () => ({ folders: [], bookmarks: [] }),
    () => false,
    (query) => suggest(query, {
      tabs: [],
      bookmarks: [{ title: 'GitHub', url: 'https://github.com/' }],
      history: indexHistory([{ title: 'GitLab', url: 'https://gitlab.com/', visitedAt: 1 }]),
    }),
  );

  const response = await handle(new Request('yalqen://newtab/suggestions?q=git'));
  assert.deepEqual((await response.json()).map(({ kind, url }) => [kind, url]), [
    ['bookmark', 'https://github.com/'],
    ['history', 'https://gitlab.com/'],
  ]);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const script = await handle(new Request('yalqen://newtab/suggestions.js'));
  assert.match(script.headers.get('content-type'), /^application\/javascript/);
  assert.match(await script.text(), /fetch\(/);

  const mark = await handle(new Request('yalqen://newtab/mark.png'));
  assert.equal(mark.headers.get('content-type'), 'image/png');
  assert.ok((await mark.arrayBuffer()).byteLength > 0);
});

test('the downloads page updates itself when the list changes', async () => {
  let handle;
  const session = { protocol: { handle(_scheme, callback) { handle = callback; } } };
  const changes = new changeFeed.ChangeFeed();
  let entries = [];
  serveInternalPages(
    session,
    page('newtab.html'),
    page('newtab-suggestions.js'),
    page('history.html'),
    page('downloads.html'),
    page('bookmarks.html'),
    () => [],
    () => [],
    () => [],
    { list: () => entries, changes },
    () => ({ folders: [], bookmarks: [] }),
    () => false,
    () => [],
  );

  const html = await (await handle(new Request('yalqen://downloads/'))).text();
  assert.match(html, /<div id="downloads" data-version="0">/);
  assert.match(html, /yalqen:\/\/downloads\/downloads\.js/);
  const script = await handle(new Request('yalqen://downloads/downloads.js'));
  assert.match(await script.text(), /downloads\/changes/);

  const waiting = handle(new Request('yalqen://downloads/changes?since=0'));
  entries = [{ id: 'a', url: 'https://a.com/f', filename: 'f.zip', savePath: '/tmp/f.zip', state: 'completed', receivedBytes: 1, totalBytes: 1, startedAt: 1 }];
  changes.notify();
  const update = await (await waiting).json();
  assert.equal(update.version, 1);
  assert.equal(update.html, downloadsModule.renderDownloads(entries));
});

test('pinned sites render as escaped tiles with a letter fallback', () => {
  const html = internalPages.renderPinned([
    { url: 'https://github.com/', title: 'GitHub', faviconUrl: 'https://github.com/favicon.ico' },
    { url: 'https://example.com/?q="x"', title: '<b>Örnek</b>', faviconUrl: null },
  ]);
  assert.match(html, /<img src="https:\/\/github\.com\/favicon\.ico"/);
  assert.match(html, /<span class="letter">E<\/span>/);
  assert.doesNotMatch(html, /<b>/);
  assert.equal(internalPages.renderPinned([]), '');
});
