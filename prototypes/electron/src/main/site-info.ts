import type { MenuItemConstructorOptions } from 'electron';
import type { SecurityState } from '../shared/types.js';

/** How the connection to `url` is shown in the address bar. */
export function securityState(url: string, certificateException = false): SecurityState {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:') return certificateException ? 'dangerous' : 'secure';
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
  dangerous: 'Geçersiz sertifika yok sayılarak bağlanıldı',
  local: 'Bu sayfa bir siteden yüklenmedi',
};

export interface SiteInfo {
  url: string;
  security: SecurityState;
}

export interface SiteInfoActions {
  /** Shows certificate warnings for the site again. */
  revokeCertificateException(): void;
}

/** Items of the menu opened from the connection indicator. */
export function siteInfoTemplate(info: SiteInfo, actions: SiteInfoActions): MenuItemConstructorOptions[] {
  let host = info.url;
  try {
    host = new URL(info.url).host || info.url;
  } catch {
    // Show the address as is.
  }
  return [
    { label: host, enabled: false },
    { label: STATE_TEXT[info.security], enabled: false },
    ...(info.security === 'dangerous'
      ? [
          { type: 'separator' as const },
          { label: 'Sertifika uyarılarını yeniden aç', click: actions.revokeCertificateException },
        ]
      : []),
  ];
}
