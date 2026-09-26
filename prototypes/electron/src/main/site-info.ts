import type { MenuItemConstructorOptions } from 'electron';
import type { SecurityState } from '../shared/types.js';

/** How the connection to `url` is shown in the address bar. */
export function securityState(url: string): SecurityState {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:') return 'secure';
    if (protocol === 'http:') return 'insecure';
  } catch {
    // Not a URL.
  }
  // The browser's own pages, files and data are not fetched from a site.
  return 'local';
}

const STATE_TEXT: Record<SecurityState, string> = {
  secure: 'Bağlantı güvenli',
  insecure: 'Bu siteye bağlantı güvenli değil',
  local: 'Bu sayfa bir siteden yüklenmedi',
};

export interface SiteInfo {
  url: string;
  security: SecurityState;
}

/** Items of the menu opened from the connection indicator. */
export function siteInfoTemplate(info: SiteInfo): MenuItemConstructorOptions[] {
  let host = info.url;
  try {
    host = new URL(info.url).host || info.url;
  } catch {
    // Show the address as is.
  }
  return [
    { label: host, enabled: false },
    { label: STATE_TEXT[info.security], enabled: false },
  ];
}
