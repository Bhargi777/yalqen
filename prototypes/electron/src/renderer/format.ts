import { NEW_TAB_URL, type TabSnapshot } from '../shared/types';

export function isNewTab(url: string): boolean {
  return url === NEW_TAB_URL || url === 'about:blank';
}

export function siteLabel(tab: TabSnapshot): string {
  if (isNewTab(tab.url)) return 'Yeni sekme';
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.host.replace(/^www\./, '');
  } catch {
  }
  return tab.title;
}
