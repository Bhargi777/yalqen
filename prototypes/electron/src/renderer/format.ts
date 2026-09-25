import { NEW_TAB_URL, type TabSnapshot } from '../shared/types';

export function isNewTab(url: string): boolean {
  return url === NEW_TAB_URL || url === 'about:blank';
}

/** Short name for a tab: the site's host for web pages, the title otherwise. */
export function siteLabel(tab: TabSnapshot): string {
  if (isNewTab(tab.url)) return 'Yeni sekme';
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.host.replace(/^www\./, '');
  } catch {
    // Not a URL; fall back to the title.
  }
  return tab.title;
}
