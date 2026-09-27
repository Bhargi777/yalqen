import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import bookmarks from '../dist/main/bookmarks.js';

const { BookmarkStore, bookmarksMenuTemplate, canBookmark, renderBookmarks } = bookmarks;

function withDir(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalqen-bookmarks-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('web pages and files can be bookmarked', () => {
  assert.equal(canBookmark('https://a.com/'), true);
  assert.equal(canBookmark('file:///tmp/a.html'), true);
  assert.equal(canBookmark('yalqen://newtab/'), false);
  assert.equal(canBookmark('javascript:alert(1)'), false);
});

test('bookmarks are added once, edited, moved and persisted', () => {
  withDir((dir) => {
    const store = new BookmarkStore(dir);
    const a = store.add('https://a.com/', '  A \n sitesi ');
    assert.equal(a.title, 'A sitesi');
    assert.equal(store.add('https://a.com/', 'başka').id, a.id);
    assert.equal(store.add('yalqen://history/', 'Geçmiş'), null);
    const b = store.add('https://b.com/', '');
    assert.equal(b.title, 'https://b.com/');

    const folder = store.addFolder('İş');
    store.move(a.id, folder.id);
    store.rename(b.id, 'B');
    store.move(b.id, 'unknown');
    assert.deepEqual(store.bookmarks('iş').length, 0);
    assert.deepEqual(store.bookmarks('b.com').map((item) => item.title), ['B']);
    store.saveNow();

    const reloaded = new BookmarkStore(dir);
    assert.deepEqual(reloaded.folders().map((item) => item.title), ['İş']);
    assert.deepEqual(reloaded.bookmarks().map((item) => [item.title, item.folderId]), [['A sitesi', folder.id], ['B', null]]);
    assert.equal(reloaded.find('https://a.com/').id, a.id);

    reloaded.removeFolder(folder.id);
    assert.equal(reloaded.find('https://a.com/').folderId, null);
    reloaded.remove(a.id);
    assert.equal(reloaded.find('https://a.com/'), undefined);
    reloaded.saveNow();
  });
});

test('bookmarked addresses are known after every change', () => {
  withDir((dir) => {
    const store = new BookmarkStore(dir);
    assert.equal(store.has('https://example.com/'), false);
    const bookmark = store.add('https://example.com/', 'Örnek');
    assert.equal(store.has('https://example.com/'), true);
    store.remove(bookmark.id);
    assert.equal(store.has('https://example.com/'), false);
    store.saveNow();
  });
});

test('damaged entries are dropped and missing folders are cleared', () => {
  withDir((dir) => {
    fs.writeFileSync(
      path.join(dir, 'bookmarks.json'),
      JSON.stringify({
        version: 1,
        folders: [{ id: 'f', title: 'F', createdAt: 1 }, { id: 3 }],
        bookmarks: [
          { id: '1', title: 'a', url: 'https://a.com/', folderId: 'gone', createdAt: 1 },
          { id: '2', title: 'x', url: 'javascript:x', folderId: null, createdAt: 1 },
          { id: '3', title: 'c', url: 'https://c.com/', folderId: 'f', createdAt: 1 },
        ],
      }),
    );
    const store = new BookmarkStore(dir);
    assert.deepEqual(store.folders().map((item) => item.id), ['f']);
    assert.deepEqual(store.bookmarks().map((item) => [item.id, item.folderId]), [['1', null], ['3', 'f']]);
  });
});

test('the menu lists folders, then loose bookmarks', () => {
  const opened = [];
  const folders = [{ id: 'f', title: 'İş', createdAt: 1 }, { id: 'g', title: 'Boş klasör', createdAt: 2 }];
  const list = [
    { id: '1', title: 'A', url: 'https://a.com/', folderId: 'f', createdAt: 1 },
    { id: '2', title: 'B'.repeat(80), url: 'https://b.com/', folderId: null, createdAt: 2 },
  ];
  const items = bookmarksMenuTemplate(folders, list, { open: (url) => opened.push(url), showAll: () => opened.push('all') });
  assert.deepEqual(items.map((item) => item.label ?? '-'), ['İş', 'Boş klasör', `${'B'.repeat(59)}…`, '-', 'Tüm yer imleri']);
  assert.deepEqual(items[1].submenu.map((item) => item.label), ['Boş']);
  items[0].submenu[0].click();
  items[2].click();
  items[4].click();
  assert.deepEqual(opened, ['https://a.com/', 'https://b.com/', 'all']);
  assert.equal(bookmarksMenuTemplate([], [], {})[0].label, 'Henüz yer imi yok');
});

test('the page escapes content and points its forms at commands', () => {
  const html = renderBookmarks(
    [{ id: 'f', title: '<i>F</i>', createdAt: 1 }],
    [{ id: 'x', title: '<b>A</b>', url: 'https://a.com/?q="', folderId: 'f', createdAt: 1 }],
    '',
  );
  assert.ok(!html.includes('<b>A</b>') && !html.includes('<i>F</i>'));
  for (const command of ['new-folder', 'rename', 'move', 'remove?id=x', 'rename-folder', 'remove-folder?id=f']) {
    assert.ok(html.includes(`yalqen://bookmarks/${command}`), command);
  }
  assert.match(renderBookmarks([], [], ''), /Henüz yer imi yok/);
  assert.match(renderBookmarks([], [], 'zzz'), /Eşleşen yer imi bulunamadı/);
});
