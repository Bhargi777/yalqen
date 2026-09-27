import fs from 'node:fs';
import path from 'node:path';
import { protocol, type Session } from 'electron';
import { HISTORY_URL, INTERNAL_SCHEME } from '../shared/types.js';
import { renderBookmarks, type Bookmark, type BookmarkFolder } from './bookmarks.js';
import type { ChangeFeed } from './change-feed.js';
import { renderDownloads, type DownloadEntry } from './downloads.js';
import type { HistoryEntry } from './history.js';
import type { AddressSuggestion } from '../shared/types.js';
import type { RecentPage } from './tabs.js';

const INTERNAL_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:";
const DOWNLOADS_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'";
const NEW_TAB_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' https: data:; script-src 'self'; connect-src 'self'";
const SETTINGS_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'";
const RECENT_MARKER = '__YALQEN_RECENT_SLOT__';
const PINNED_MARKER = '__YALQEN_PINNED_SLOT__';
const WELCOME_MARKER = '__YALQEN_WELCOME_SLOT__';
const TIPS_MARKER = '__YALQEN_TIPS_SLOT__';
const HISTORY_MARKER = '__YALQEN_HISTORY_SLOT__';
const DOWNLOADS_MARKER = '__YALQEN_DOWNLOADS_SLOT__';
const BOOKMARKS_MARKER = '__YALQEN_BOOKMARKS_SLOT__';
const FORGET_ICON =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>';
const SMALL_FORGET_ICON = FORGET_ICON.replace('width="14" height="14"', 'width="11" height="11"');

export function registerInternalScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: INTERNAL_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function renderRecent(pages: RecentPage[]): string {
  if (pages.length === 0) return '';
  const items = pages
    .map((page) => {
      const icon = page.faviconUrl?.startsWith('https:')
        ? `<img src="${escapeHtml(page.faviconUrl)}" alt="" width="16" height="16" />`
        : '<span class="dot"></span>';
      const forget = `yalqen://newtab/forget?url=${encodeURIComponent(page.url)}`;
      return (
        `<li><a href="${escapeHtml(page.url)}" title="${escapeHtml(page.title)}">${icon}<span>${escapeHtml(hostOf(page.url))}</span></a>` +
        `<a class="forget" href="${escapeHtml(forget)}" aria-label="Listeden kaldır: ${escapeHtml(hostOf(page.url))}">${SMALL_FORGET_ICON}</a></li>`
      );
    })
    .join('');
  return `<section class="recent" aria-labelledby="recent-title"><h2 id="recent-title">Son kapatılanlar</h2><ul>${items}</ul></section>`;
}

export function renderPinned(pages: RecentPage[]): string {
  if (pages.length === 0) return '';
  const items = pages
    .map((page) => {
      const host = hostOf(page.url);
      const icon = page.faviconUrl?.startsWith('https:')
        ? `<img src="${escapeHtml(page.faviconUrl)}" alt="" width="24" height="24" />`
        : `<span class="letter">${escapeHtml(host.charAt(0).toLocaleUpperCase('tr'))}</span>`;
      return `<li><a href="${escapeHtml(page.url)}" title="${escapeHtml(page.title || host)}"><span class="tile">${icon}</span><span class="name">${escapeHtml(host)}</span></a></li>`;
    })
    .join('');
  return `<nav class="pinned" aria-label="Sabitlenenler"><ul>${items}</ul></nav>`;
}

function renderWelcome(): string {
  return `<section class="welcome" aria-labelledby="welcome-title">
    <h1 id="welcome-title">Yalqen'e hoş geldin.</h1>
    <p>İnternette kendi yolunu aç. Aramak ya da bir adres yazmak için başlayabilirsin.</p>
  </section>`;
}

function renderTips(): string {
  return `<ul class="tips" aria-label="İpuçları">
    <li><strong>Sekmeler solda</strong><small>Açık sayfalarını yan panelde düzenle.</small></li>
    <li><strong>Sık kullandıklarını sabitle</strong><small>Bir sekmeyi canlı tutmak için iğneye bas.</small></li>
    <li><strong>Daha az reklam</strong><small>Reklam engelleme varsayılan olarak açık.</small></li>
  </ul>`;
}

export function renderHistory(entries: HistoryEntry[], query: string): string {
  const search = query.trim().slice(0, 200);
  const form = `<form action="${HISTORY_URL}" method="get"><input name="q" type="search" placeholder="Geçmişte ara" aria-label="Geçmişte ara" value="${escapeHtml(search)}" autofocus /></form>`;
  if (entries.length === 0) {
    const message = search ? 'Eşleşen sayfa bulunamadı.' : 'Henüz ziyaret edilen bir sayfa yok.';
    return `${form}<p class="empty">${message}</p>`;
  }
  let previousDay = '';
  const rows = entries.map((entry) => {
    const day = new Date(entry.visitedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const heading = day === previousDay ? '' : `<li class="day"><h2>${escapeHtml(day)}</h2></li>`;
    previousDay = day;
    const time = new Date(entry.visitedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const host = hostOf(entry.url);
    const remove = `${HISTORY_URL}delete?id=${encodeURIComponent(entry.id)}`;
    return `${heading}<li><time>${escapeHtml(time)}</time><a class="visit" href="${escapeHtml(entry.url)}"><strong>${escapeHtml(entry.title || host)}</strong><span>${escapeHtml(host)}</span></a><a class="remove" href="${escapeHtml(remove)}" aria-label="Geçmişten kaldır: ${escapeHtml(entry.title || host)}" title="Geçmişten kaldır">${FORGET_ICON}</a></li>`;
  }).join('');
  const clear = search ? '' : `<a class="clear" href="${HISTORY_URL}confirm-clear">Tüm geçmişi temizle</a>`;
  return `${form}<div class="results"><div class="summary"><span>${entries.length} ziyaret</span>${clear}</div><ol>${rows}</ol></div>`;
}

const ASSET_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function serveSettings(pathname: string, page: string, assetsDir: string): Response {
  if (!pathname.startsWith('/assets/')) {
    return new Response(page, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': SETTINGS_CSP, 'cache-control': 'no-store' },
    });
  }
  const name = pathname.slice('/assets/'.length);
  const type = ASSET_TYPES[path.extname(name)];
  if (!type || name !== path.basename(name)) return new Response('Not found', { status: 404 });
  try {
    return new Response(fs.readFileSync(path.join(assetsDir, name)), { headers: { 'content-type': type } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

export function serveInternalPages(
  session: Session,
  newTabFile: string,
  newTabScriptFile: string,
  historyFile: string,
  downloadsFile: string,
  bookmarksFile: string,
  settingsFile: string,
  recent: () => RecentPage[],
  pinned: () => RecentPage[],
  visits: (query: string) => HistoryEntry[],
  downloads: { list: () => DownloadEntry[]; changes: ChangeFeed },
  bookmarks: (query: string) => { folders: BookmarkFolder[]; bookmarks: Bookmark[] },
  showWelcome: () => boolean,
  suggestions: (query: string) => AddressSuggestion[],
): void {
  const page = fs.readFileSync(newTabFile, 'utf8');
  const newTabScript = fs.readFileSync(newTabScriptFile, 'utf8');
  const newTabMark = fs.readFileSync(path.join(path.dirname(newTabFile), 'newtab-mark.png'));
  const historyPage = fs.readFileSync(historyFile, 'utf8');
  const downloadsPage = fs.readFileSync(downloadsFile, 'utf8');
  const downloadsScript = fs.readFileSync(path.join(path.dirname(downloadsFile), 'downloads.js'), 'utf8');
  const bookmarksPage = fs.readFileSync(bookmarksFile, 'utf8');
  const settingsPage = fs.readFileSync(settingsFile, 'utf8');
  const settingsAssets = path.join(path.dirname(settingsFile), 'assets');
  const htmlHeaders = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': INTERNAL_CSP,
    'cache-control': 'no-store',
  };

  session.protocol.handle(INTERNAL_SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.host === 'settings') return serveSettings(url.pathname, settingsPage, settingsAssets);
    if (url.host === 'newtab' && url.pathname === '/suggestions.js') {
      return new Response(newTabScript, {
        headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (url.host === 'newtab' && url.pathname === '/mark.png') {
      return new Response(newTabMark, { headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' } });
    }
    if (url.host === 'newtab' && url.pathname === '/suggestions') {
      return Response.json(suggestions(url.searchParams.get('q') ?? ''), {
        headers: { 'cache-control': 'no-store' },
      });
    }
    if (url.host === 'bookmarks') {
      if (url.pathname !== '/') return new Response('Not found', { status: 404 });
      const query = url.searchParams.get('q') ?? '';
      const data = bookmarks(query);
      return new Response(bookmarksPage.replace(BOOKMARKS_MARKER, renderBookmarks(data.folders, data.bookmarks, query)), {
        headers: htmlHeaders,
      });
    }
    if (url.host === 'downloads' && url.pathname === '/downloads.js') {
      return new Response(downloadsScript, {
        headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (url.host === 'downloads' && url.pathname === '/changes') {
      const since = Number(url.searchParams.get('since'));
      return downloads.changes.next(since).then((version) =>
        Response.json({ version, html: renderDownloads(downloads.list()) }, { headers: { 'cache-control': 'no-store' } }),
      );
    }
    if (url.host === 'downloads') {
      if (url.pathname !== '/') return new Response('Not found', { status: 404 });
      const list = `<div id="downloads" data-version="${downloads.changes.version}">${renderDownloads(downloads.list())}</div>`;
      return new Response(downloadsPage.replace(DOWNLOADS_MARKER, list), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': DOWNLOADS_CSP,
          'cache-control': 'no-store',
        },
      });
    }
    if (url.host === 'history') {
      let content: string;
      if (url.pathname === '/') {
        const query = url.searchParams.get('q') ?? '';
        content = renderHistory(visits(query), query);
      } else if (url.pathname === '/confirm-clear') {
        content = `<div class="confirm"><h2>Tüm geçmiş temizlensin mi?</h2><p>Bu işlem ziyaret kayıtlarını kalıcı olarak siler.</p><div class="confirm-actions"><a href="${HISTORY_URL}">Vazgeç</a><a class="danger" href="${HISTORY_URL}clear">Geçmişi temizle</a></div></div>`;
      } else {
        return new Response('Not found', { status: 404 });
      }
      return new Response(historyPage.replace(HISTORY_MARKER, content), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': INTERNAL_CSP,
          'cache-control': 'no-store',
        },
      });
    }
    if (url.host !== 'newtab' || url.pathname !== '/') {
      return new Response('Not found', { status: 404 });
    }
    const welcomeVisible = showWelcome();
    return new Response(
      page
        .replace(WELCOME_MARKER, welcomeVisible ? renderWelcome() : '')
        .replace(PINNED_MARKER, renderPinned(pinned()))
        .replace(TIPS_MARKER, welcomeVisible ? renderTips() : '')
        .replace(RECENT_MARKER, renderRecent(recent())),
      { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': NEW_TAB_CSP } },
    );
  });
}
