import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import internalPages from '../dist/main/internal-pages.js';
import suggestionModule from '../dist/main/suggestions.js';

const { serveInternalPages } = internalPages;
const { suggest } = suggestionModule;
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
    () => ({ folders: [], bookmarks: [] }),
    () => false,
    (query) => suggest(query, {
      tabs: [],
      bookmarks: [{ title: 'GitHub', url: 'https://github.com/' }],
      history: [{ title: 'GitLab', url: 'https://gitlab.com/', visitedAt: 1 }],
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
