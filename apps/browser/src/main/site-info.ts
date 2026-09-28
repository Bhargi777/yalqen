import type { MenuItemConstructorOptions } from 'electron';
import type { SecurityState } from '../shared/types.js';
import { PERMISSION_LABELS, type Decision, type SitePermission } from './permissions.js';
import { siteDataItems, type SiteData, type SiteDataActions } from './site-data.js';

export function securityState(url: string, certificateException = false): SecurityState {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:') return certificateException ? 'dangerous' : 'secure';
    if (protocol === 'http:') return 'insecure';
  } catch {}
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
  permissions: { kind: SitePermission; decision: Decision }[];
  data?: SiteData;
}

export interface SiteInfoActions extends SiteDataActions {
  revokeCertificateException(): void;
  setPermission(kind: SitePermission, decision: Decision | null): void;
}

const DECISION_TEXT: Record<Decision, string> = { allow: 'İzin verildi', deny: 'Engellendi' };

export function siteInfoTemplate(info: SiteInfo, actions: SiteInfoActions): MenuItemConstructorOptions[] {
  let host = info.url;
  try {
    host = new URL(info.url).host || info.url;
  } catch {}
  return [
    { label: host, enabled: false },
    { label: STATE_TEXT[info.security], enabled: false },
    ...(info.security === 'dangerous'
      ? [
          { type: 'separator' as const },
          { label: 'Sertifika uyarılarını yeniden aç', click: actions.revokeCertificateException },
        ]
      : []),
    ...(info.permissions.length > 0 ? [{ type: 'separator' as const }] : []),
    ...info.permissions.map(({ kind, decision }): MenuItemConstructorOptions => ({
      label: `${PERMISSION_LABELS[kind]}: ${DECISION_TEXT[decision]}`,
      submenu: (
        [
          ['Sor', null],
          ['İzin ver', 'allow'],
          ['Engelle', 'deny'],
        ] as const
      ).map(([label, choice]) => ({
        label: choice === null && kind === 'popups' ? 'Varsayılan (engelle)' : label,
        type: 'radio' as const,
        checked: choice === decision,
        click: () => actions.setPermission(kind, choice),
      })),
    })),
    ...(info.data ? siteDataItems(info.data, actions) : []),
  ];
}
