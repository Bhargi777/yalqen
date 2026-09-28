import type { MenuItemConstructorOptions } from 'electron';
import {
  AUTO_RELOAD_SECONDS,
  NETWORK_PRESETS,
  USER_AGENT_PRESETS,
  type DevCommandId,
  type PageOverrides,
} from '../shared/types.js';
import { NETWORK_CONDITIONS, USER_AGENTS, hasOverrides } from './page-overrides.js';

export interface DevMenuState {
  consoleErrors: number;
  autoReloadSeconds: number | null;
  overrides: PageOverrides;
}

export interface DevMenuActions {
  run(id: DevCommandId): void;
  openDevTools(): void;
}

function radio(label: string, checked: boolean, click: () => void): MenuItemConstructorOptions {
  return { label, type: 'radio', checked, click };
}

export function devMenuTemplate(state: DevMenuState, actions: DevMenuActions): MenuItemConstructorOptions[] {
  const { overrides, consoleErrors } = state;
  const run = (id: DevCommandId) => () => actions.run(id);
  return [
    ...(consoleErrors > 0
      ? [
          { label: `Konsolda ${consoleErrors > 99 ? '99+' : consoleErrors} hata`, click: actions.openDevTools },
          { type: 'separator' as const },
        ]
      : []),
    { label: 'Önbelleği kapat', type: 'checkbox', checked: overrides.cacheDisabled, click: run('toggle-cache') },
    {
      label: 'Ağ',
      submenu: [
        radio('Kısıtlama yok', overrides.network === null, run('network-online')),
        ...NETWORK_PRESETS.map((preset) =>
          radio(NETWORK_CONDITIONS[preset].label, overrides.network === preset, run(`network-${preset}`)),
        ),
      ],
    },
    {
      label: 'Otomatik yenile',
      submenu: [
        radio('Kapalı', state.autoReloadSeconds === null, run('auto-reload-off')),
        ...AUTO_RELOAD_SECONDS.map((seconds) =>
          radio(
            seconds < 60 ? `${seconds} saniye` : `${seconds / 60} dakika`,
            state.autoReloadSeconds === seconds,
            run(`auto-reload-${seconds}`),
          ),
        ),
      ],
    },
    { type: 'separator' },
    {
      label: 'Tema',
      submenu: [
        radio('Sistem', overrides.colorScheme === null, run('color-scheme-auto')),
        radio('Açık', overrides.colorScheme === 'light', run('color-scheme-light')),
        radio('Koyu', overrides.colorScheme === 'dark', run('color-scheme-dark')),
      ],
    },
    {
      label: 'Azaltılmış hareket',
      type: 'checkbox',
      checked: overrides.reducedMotion,
      click: run('toggle-reduced-motion'),
    },
    { label: 'Yazdırma görünümü', type: 'checkbox', checked: overrides.printMedia, click: run('toggle-print-media') },
    {
      label: 'User-Agent',
      submenu: [
        radio('Varsayılan', overrides.userAgent === null, run('user-agent-default')),
        ...USER_AGENT_PRESETS.map((preset) =>
          radio(USER_AGENTS[preset].label, overrides.userAgent === preset, run(`user-agent-${preset}`)),
        ),
      ],
    },
    { type: 'separator' },
    {
      label: 'İstek kurallarını uygula',
      type: 'checkbox',
      checked: overrides.requestRules,
      click: run('toggle-request-rules'),
    },
    { label: 'İstek kurallarını düzenle…', click: run('edit-request-rules') },
    { type: 'separator' },
    { label: 'Taklitleri sıfırla', enabled: hasOverrides(overrides), click: run('reset-overrides') },
  ];
}
