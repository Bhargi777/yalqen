import fs from 'node:fs';
import path from 'node:path';
import type { FontSizeSetting, PageLanguage, PanelSide, SecureDnsSetting, SettingsValues, ThemeSource } from '../shared/types.js';
import { DEFAULT_ZOOM_FACTORS, FONT_SIZES } from './page-preferences.js';
import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from './search.js';

export interface Settings extends SettingsValues {
  version: 1;
}

const DEFAULTS: Settings = {
  version: 1,
  searchEngine: DEFAULT_SEARCH_ENGINE,
  customSearchTemplate: null,
  theme: 'light',
  startupBehavior: 'restore',
  panelCollapsed: false,
  panelSide: 'left',
  sidebarVisible: true,
  toolbarVisible: true,
  toolbarTabs: true,
  freezeBackgroundTabs: true,
  adBlocking: true,
  httpsOnly: false,
  blockThirdPartyCookies: false,
  secureDns: 'automatic',
  fontSize: 'medium',
  defaultZoom: 1,
  pageLanguage: 'tr',
  welcomeCompleted: false,
};

const ENGINE_IDS = new Set<string>([...SEARCH_ENGINES.map((engine) => engine.id), 'custom']);
const THEMES = new Set<string>(['system', 'light', 'dark'] satisfies ThemeSource[]);
const PANEL_SIDES = new Set<string>(['left', 'right'] satisfies PanelSide[]);
const SECURE_DNS = new Set<string>(['off', 'automatic', 'cloudflare', 'google', 'quad9'] satisfies SecureDnsSetting[]);
const STARTUP_BEHAVIORS = new Set<string>(['restore', 'new-tab'] satisfies Settings['startupBehavior'][]);

export function sanitizeSettings(data: unknown, base: Settings = DEFAULTS): Settings {
  const input = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const {
    searchEngine,
    customSearchTemplate,
    theme,
    startupBehavior,
    panelCollapsed,
    panelSide,
    sidebarVisible,
    toolbarVisible,
    toolbarTabs,
    freezeBackgroundTabs,
    adBlocking,
    httpsOnly,
    blockThirdPartyCookies,
    secureDns,
    fontSize,
    defaultZoom,
    pageLanguage,
    welcomeCompleted,
  } = input;
  return {
    version: 1,
    searchEngine:
      typeof searchEngine === 'string' && ENGINE_IDS.has(searchEngine)
        ? (searchEngine as Settings['searchEngine'])
        : base.searchEngine,
    customSearchTemplate:
      customSearchTemplate === null || typeof customSearchTemplate === 'string'
        ? customSearchTemplate?.trim() || null
        : base.customSearchTemplate,
    theme: typeof theme === 'string' && THEMES.has(theme) ? (theme as ThemeSource) : base.theme,
    startupBehavior:
      typeof startupBehavior === 'string' && STARTUP_BEHAVIORS.has(startupBehavior)
        ? (startupBehavior as Settings['startupBehavior'])
        : base.startupBehavior,
    panelCollapsed: typeof panelCollapsed === 'boolean' ? panelCollapsed : base.panelCollapsed,
    panelSide:
      typeof panelSide === 'string' && PANEL_SIDES.has(panelSide) ? (panelSide as PanelSide) : base.panelSide,
    sidebarVisible: typeof sidebarVisible === 'boolean' ? sidebarVisible : base.sidebarVisible,
    toolbarVisible: typeof toolbarVisible === 'boolean' ? toolbarVisible : base.toolbarVisible,
    toolbarTabs: typeof toolbarTabs === 'boolean' ? toolbarTabs : base.toolbarTabs,
    freezeBackgroundTabs:
      typeof freezeBackgroundTabs === 'boolean' ? freezeBackgroundTabs : base.freezeBackgroundTabs,
    adBlocking: typeof adBlocking === 'boolean' ? adBlocking : base.adBlocking,
    httpsOnly: typeof httpsOnly === 'boolean' ? httpsOnly : base.httpsOnly,
    blockThirdPartyCookies:
      typeof blockThirdPartyCookies === 'boolean' ? blockThirdPartyCookies : base.blockThirdPartyCookies,
    secureDns:
      typeof secureDns === 'string' && SECURE_DNS.has(secureDns) ? (secureDns as SecureDnsSetting) : base.secureDns,
    fontSize: typeof fontSize === 'string' && fontSize in FONT_SIZES ? (fontSize as FontSizeSetting) : base.fontSize,
    defaultZoom:
      typeof defaultZoom === 'number' && (DEFAULT_ZOOM_FACTORS as readonly number[]).includes(defaultZoom)
        ? defaultZoom
        : base.defaultZoom,
    pageLanguage: pageLanguage === 'tr' || pageLanguage === 'en' ? (pageLanguage as PageLanguage) : base.pageLanguage,
    welcomeCompleted: typeof welcomeCompleted === 'boolean' ? welcomeCompleted : base.welcomeCompleted,
  };
}

export class SettingsStore {
  readonly file: string;
  private current: Settings;

  constructor(directory: string) {
    this.file = path.join(directory, 'settings.json');
    this.current = this.load();
  }

  get(): Settings {
    return this.current;
  }

  update(patch: unknown): Settings {
    this.current = sanitizeSettings({ ...this.current, ...(patch as object) }, this.current);
    const temp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(this.current, null, 2));
    fs.renameSync(temp, this.file);
    return this.current;
  }

  private load(): Settings {
    try {
      return sanitizeSettings(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch {
      return { ...DEFAULTS };
    }
  }
}
