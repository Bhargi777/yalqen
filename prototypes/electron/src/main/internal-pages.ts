import fs from 'node:fs';
import { protocol, type Session } from 'electron';
import { HISTORY_URL, INTERNAL_SCHEME } from '../shared/types.js';
import { renderBookmarks, type Bookmark, type BookmarkFolder } from './bookmarks.js';
import { renderDownloads, type DownloadEntry } from './downloads.js';
import type { HistoryEntry } from './history.js';
import type { RecentPage } from './tabs.js';

// Favicons of recent pages come from the web; nothing else is loaded.
const NEW_TAB_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:";
const RECENT_MARKER = '<!-- recent -->';
const WELCOME_MARKER = '<!-- welcome -->';
const WELCOME_ACTION_MARKER = '<!-- welcome-action -->';
const HISTORY_MARKER = '<!-- visits -->';
const DOWNLOADS_MARKER = '<!-- downloads -->';
const BOOKMARKS_MARKER = '<!-- bookmarks -->';
const FORGET_ICON =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>';

/** Must run before the app is ready. */
export function registerInternalScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: INTERNAL_SCHEME, privileges: { standard: true, secure: true } },
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

/** Renders the recently closed pages list, or nothing when there are none. */
export function renderRecent(pages: RecentPage[]): string {
  if (pages.length === 0) return '';
  const items = pages
    .map((page) => {
      const icon = page.faviconUrl?.startsWith('https:')
        ? `<img src="${escapeHtml(page.faviconUrl)}" alt="" width="18" height="18" />`
        : '<span class="dot"></span>';
      const forget = `yalqen://newtab/forget?url=${encodeURIComponent(page.url)}`;
      return (
        `<li><a href="${escapeHtml(page.url)}" title="${escapeHtml(page.title)}">${icon}<span>${escapeHtml(hostOf(page.url))}</span></a>` +
        `<a class="forget" href="${escapeHtml(forget)}" aria-label="Listeden kaldır">${FORGET_ICON}</a></li>`
      );
    })
    .join('');
  return `<h2>Son kapatılanlar</h2><ul class="recent">${items}</ul>`;
}

function renderWelcome(): string {
  return `<section class="welcome" aria-labelledby="welcome-title">
    <p class="eyebrow">YALQEN</p>
    <h1 id="welcome-title">Merhaba, hoş geldin.</h1>
    <p class="welcome-copy">İnternette kendi yolunu aç. Aramak ya da bir adres yazmak için başlayabilirsin.</p>
    <ul class="tips">
      <li><span class="tip-icon">↔</span><span><strong>Sekmelerin elinin altında</strong><small>Açık sayfalarını soldaki panelde düzenle.</small></span></li>
      <li><span class="tip-icon">⌑</span><span><strong>Sık kullandıklarını sabitle</strong><small>Bir sekmeyi canlı tutmak için iğne simgesine bas.</small></span></li>
      <li><span class="tip-icon">◈</span><span><strong>Daha az reklam</strong><small>Reklam engelleme varsayılan olarak açık.</small></span></li>
    </ul>
  </section>`;
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

/** Serves the browser's own pages with their current data filled in. */
export function serveInternalPages(
  session: Session,
  newTabFile: string,
  historyFile: string,
  downloadsFile: string,
  bookmarksFile: string,
  recent: () => RecentPage[],
  visits: (query: string) => HistoryEntry[],
  downloads: () => DownloadEntry[],
  bookmarks: (query: string) => { folders: BookmarkFolder[]; bookmarks: Bookmark[] },
  showWelcome: () => boolean,
): void {
  const page = fs.readFileSync(newTabFile, 'utf8');
  const historyPage = fs.readFileSync(historyFile, 'utf8');
  const downloadsPage = fs.readFileSync(downloadsFile, 'utf8');
  const bookmarksPage = fs.readFileSync(bookmarksFile, 'utf8');
  const htmlHeaders = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': NEW_TAB_CSP,
    'cache-control': 'no-store',
  };

  session.protocol.handle(INTERNAL_SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.host === 'bookmarks') {
      // Commands are links and forms the tab handles; only the list itself is served.
      if (url.pathname !== '/') return new Response('Not found', { status: 404 });
      const query = url.searchParams.get('q') ?? '';
      const data = bookmarks(query);
      return new Response(bookmarksPage.replace(BOOKMARKS_MARKER, renderBookmarks(data.folders, data.bookmarks, query)), {
        headers: htmlHeaders,
      });
    }
    if (url.host === 'downloads') {
      // Commands are links the tab handles; only the list itself is served.
      if (url.pathname !== '/') return new Response('Not found', { status: 404 });
      return new Response(downloadsPage.replace(DOWNLOADS_MARKER, renderDownloads(downloads())), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': NEW_TAB_CSP,
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
          'content-security-policy': NEW_TAB_CSP,
          'cache-control': 'no-store',
        },
      });
    }
    if (url.host !== 'newtab' || url.pathname !== '/') {
      return new Response('Not found', { status: 404 });
    }
    const welcomeVisible = showWelcome();
    const welcome = welcomeVisible ? renderWelcome() : '';
    const welcomeAction = welcomeVisible
      ? '<button class="welcome-start" type="submit" form="search-form">Aramaya başla <span aria-hidden="true">↗</span></button>'
      : '';
    return new Response(
      page
        .replace(WELCOME_MARKER, welcome)
        .replace(WELCOME_ACTION_MARKER, welcomeAction)
        .replace(RECENT_MARKER, renderRecent(recent())),
      { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': NEW_TAB_CSP } },
    );
  });
}
