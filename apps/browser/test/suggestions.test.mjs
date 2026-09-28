import assert from 'node:assert/strict';
import { test } from 'node:test';
import suggestions from '../dist/main/suggestions.js';

const { MAX_SUGGESTIONS, indexHistory, suggest: suggestFrom } = suggestions;

const suggest = (input, { history, ...rest }) => suggestFrom(input, { ...rest, history: indexHistory(history) });

const sources = {
  tabs: [{ id: 't1', title: 'GitHub', url: 'https://github.com/' }],
  bookmarks: [
    { title: 'GitHub', url: 'https://github.com/' },
    { title: 'Resmî Gazete', url: 'https://www.resmigazete.gov.tr/' },
  ],
  history: [
    { title: 'Hacker News', url: 'https://news.ycombinator.com/', visitedAt: 30 },
    { title: 'GitLab', url: 'https://gitlab.com/', visitedAt: 20 },
    { title: 'Hacker News', url: 'https://news.ycombinator.com/', visitedAt: 10 },
    { title: 'Git kitabı', url: 'https://git-scm.com/book/tr', visitedAt: 5 },
    { title: 'Resmî Gazete', url: 'https://www.resmigazete.gov.tr/', visitedAt: 1 },
  ],
};

test('suggestions carry the latest favicon seen for their host', () => {
  const list = suggest('git', {
    ...sources,
    history: [
      {
        title: 'GitHub repo',
        url: 'https://github.com/org/repo',
        visitedAt: 40,
        faviconUrl: 'https://github.com/new.ico',
      },
      { title: 'GitHub', url: 'https://github.com/', visitedAt: 35, faviconUrl: 'https://github.com/old.ico' },
      ...sources.history,
    ],
  });
  assert.equal(list.find((item) => item.url === 'https://github.com/').faviconUrl, 'https://github.com/new.ico');
  assert.equal(list.find((item) => item.url === 'https://gitlab.com/').faviconUrl, undefined);
});

test('nothing is suggested for empty input', () => {
  assert.deepEqual(suggest('  ', sources), []);
});

test('open tabs come first and each address appears once', () => {
  const list = suggest('git', sources);
  assert.deepEqual(
    list.map((item) => [item.kind, item.url]),
    [
      ['tab', 'https://github.com/'],
      ['history', 'https://gitlab.com/'],
      ['history', 'https://git-scm.com/book/tr'],
    ],
  );
  assert.equal(list[0].tabId, 't1');
});

test('addresses match without scheme or www, titles match by word', () => {
  assert.deepEqual(
    suggest('resmi', sources).map((item) => item.kind),
    ['bookmark'],
  );
  assert.deepEqual(
    suggest('news', sources).map((item) => item.title),
    ['Hacker News'],
  );
  assert.deepEqual(
    suggest('KİTAB', sources).map((item) => item.title),
    ['Git kitabı'],
  );
});

test('frequently visited pages rank higher among equal matches', () => {
  const list = suggest('h', {
    tabs: [],
    bookmarks: [],
    history: [
      { title: 'Once', url: 'https://h1.com/', visitedAt: 100 },
      { title: 'Often', url: 'https://h2.com/', visitedAt: 50 },
      { title: 'Often', url: 'https://h2.com/', visitedAt: 40 },
    ],
  });
  assert.deepEqual(
    list.map((item) => item.title),
    ['Often', 'Once'],
  );
});

test('the list is limited', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({
    title: `Sayfa ${i}`,
    url: `https://a.com/${i}`,
    visitedAt: i,
  }));
  assert.equal(suggest('a.com', { tabs: [], bookmarks: [], history }).length, MAX_SUGGESTIONS);
});
