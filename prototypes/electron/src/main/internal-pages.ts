import fs from 'node:fs';
import { protocol, type Session } from 'electron';
import { INTERNAL_SCHEME } from '../shared/types.js';
import type { RecentPage } from './tabs.js';

// Favicons of recent pages come from the web; nothing else is loaded.
const NEW_TAB_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:";
const RECENT_MARKER = '<!-- recent -->';
const FORGET_ICON =
  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m5 5 6 6m0-6-6 6"/></svg>';

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
        ? `<img src="${escapeHtml(page.faviconUrl)}" alt="" width="14" height="14" />`
        : '<span class="dot"></span>';
      const forget = `yalqen://newtab/forget?url=${encodeURIComponent(page.url)}`;
      return (
        `<li><a href="${escapeHtml(page.url)}" title="${escapeHtml(page.title)}">${icon}<span>${escapeHtml(hostOf(page.url))}</span></a>` +
        `<a class="forget" href="${escapeHtml(forget)}" aria-label="Listeden kaldır">${FORGET_ICON}</a></li>`
      );
    })
    .join('');
  return `<ul class="recent" aria-label="Son kapatılanlar">${items}</ul>`;
}

/** Serves yalqen://newtab/ from a static file, with the recently closed pages filled in. */
export function serveInternalPages(session: Session, newTabFile: string, recent: () => RecentPage[]): void {
  const page = fs.readFileSync(newTabFile, 'utf8');

  session.protocol.handle(INTERNAL_SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.host !== 'newtab' || url.pathname !== '/') {
      return new Response('Not found', { status: 404 });
    }
    return new Response(page.replace(RECENT_MARKER, renderRecent(recent())), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': NEW_TAB_CSP },
    });
  });
}
