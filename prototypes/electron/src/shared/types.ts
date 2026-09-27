export type TabId = string;

export const INTERNAL_SCHEME = 'yalqen';
export const NEW_TAB_URL = 'yalqen://newtab/';
export const HISTORY_URL = 'yalqen://history/';
export const DOWNLOADS_URL = 'yalqen://downloads/';
export const BOOKMARKS_URL = 'yalqen://bookmarks/';
export const SETTINGS_URL = 'yalqen://settings/';
export type CommandPage = 'downloads' | 'bookmarks';

export type SearchEngineId = 'google' | 'yandex' | 'duckduckgo' | 'bing' | 'brave' | 'ecosia' | 'custom';
export type ThemeSource = 'system' | 'light' | 'dark';
export type SecureDnsSetting = 'off' | 'automatic' | 'cloudflare' | 'google' | 'quad9';
export type FontSizeSetting = 'small' | 'medium' | 'large' | 'xlarge';
export type PageLanguage = 'tr' | 'en';
export type SecurityState = 'secure' | 'insecure' | 'dangerous' | 'local';

export interface TabSnapshot {
  id: TabId;
  title: string;
  url: string;
  faviconUrl: string | null;
  live: boolean;
  frozen: boolean;
  loading: boolean;
  pinned: boolean;
  security: SecurityState;
  isPrivate: boolean;
  bookmarked: boolean;
  blockedPopups: number;
  audible: boolean;
  muted: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export type DeviceId = 'iphone-15' | 'iphone-se' | 'pixel-8' | 'ipad-mini';

export interface DeviceFrame {
  label: string;
  width: number;
  height: number;
  scale: number;
  cornerRadius: number;
  x: number;
  y: number;
  viewWidth: number;
  viewHeight: number;
}

export type WindowMaterial = 'glass' | 'opaque';

export type PanelSide = 'left' | 'right';

export interface BrowserState {
  tabs: TabSnapshot[];
  activeTabId: TabId | null;
  pageFullScreen: boolean;
  windowFullScreen: boolean;
  addressPlaceholder: string;
  panelCollapsed: boolean;
  panelSide: PanelSide;
  sidebarVisible: boolean;
  toolbarVisible: boolean;
  toolbarTabs: boolean;
  material: WindowMaterial;
  device: DeviceFrame | null;
  zoom: number;
  defaultZoom: number;
  downloads: DownloadsSummary;
}

export interface DownloadsSummary {
  active: number;
  progress: number | null;
}

export interface ChromeLayout {
  panelWidth: number;
  panelSide: PanelSide;
  chromeHeight: number;
  pageInset: number;
  pageRadius: number;
  newTabCenterOffset: number;
}

export type UiAction =
  | { type: 'new-tab'; url?: string }
  | { type: 'activate-tab'; id: TabId }
  | { type: 'close-tab'; id: TabId }
  | { type: 'discard-tab'; id: TabId }
  | { type: 'toggle-pin'; id: TabId }
  | { type: 'toggle-mute'; id: TabId }
  | { type: 'move-tab'; id: TabId; toIndex: number }
  | { type: 'navigate'; input: string }
  | { type: 'go-back' }
  | { type: 'go-forward' }
  | { type: 'reload' }
  | { type: 'stop' }
  | { type: 'reset-zoom' }
  | { type: 'open-site-info' }
  | { type: 'open-blocked-popups' }
  | { type: 'toggle-bookmark' }
  | { type: 'open-bookmarks-menu' }
  | { type: 'toggle-panel' }
  | { type: 'toggle-sidebar' }
  | { type: 'open-address' }
  | { type: 'open-profile-menu' }
  | { type: 'open-downloads' }
  | { type: 'open-history' }
  | { type: 'open-settings' };

export const PageChannel = {
  swipe: 'yalqen:page-swipe',
  newTabCenter: 'yalqen:newtab-center',
} as const;

export interface NewTabCenter {
  offset: number;
  width: number | null;
}

export const IpcChannel = {
  getState: 'yalqen:get-state',
  state: 'yalqen:state',
  setLayout: 'yalqen:set-layout',
  action: 'yalqen:action',
  wallpaper: 'yalqen:wallpaper',
} as const;

export interface Wallpaper {
  dataUrl: string;
  split: boolean;
}

export interface YalqenApi {
  getState(): Promise<BrowserState>;
  onState(listener: (state: BrowserState) => void): () => void;
  onWallpaper(listener: (wallpaper: Wallpaper | null) => void): () => void;
  setLayout(layout: ChromeLayout): void;
  send(action: UiAction): void;
}

export interface CommandBarOpen {
  placeholder: string;
  mode: 'navigate' | 'new-tab';
  value?: string;
}

export interface AddressSuggestion {
  kind: 'tab' | 'bookmark' | 'history';
  title: string;
  url: string;
  tabId?: TabId;
  faviconUrl?: string;
}

export interface CommandBarSuggestions {
  input: string;
  suggestions: AddressSuggestion[];
}

export type CommandBarAction =
  | { type: 'submit'; input: string }
  | { type: 'switch-tab'; id: TabId }
  | { type: 'dismiss' }
  | { type: 'input'; input: string };

export const CommandBarChannel = {
  open: 'yalqen-command:open',
  suggestions: 'yalqen-command:suggestions',
  action: 'yalqen-command:action',
} as const;

export interface CommandBarApi {
  onOpen(listener: (open: CommandBarOpen) => void): () => void;
  onSuggestions(listener: (suggestions: CommandBarSuggestions) => void): () => void;
  send(action: CommandBarAction): void;
}

export interface FindResult {
  active: number;
  matches: number;
}

export type FindBarAction =
  | { type: 'find'; text: string; forward: boolean; next: boolean }
  | { type: 'close' };

export const FindBarChannel = {
  open: 'yalqen-find:open',
  result: 'yalqen-find:result',
  action: 'yalqen-find:action',
} as const;

export interface FindBarApi {
  onOpen(listener: () => void): () => void;
  onResult(listener: (result: FindResult) => void): () => void;
  send(action: FindBarAction): void;
}

export interface SettingsValues {
  searchEngine: SearchEngineId;
  customSearchTemplate: string | null;
  theme: ThemeSource;
  startupBehavior: 'restore' | 'new-tab';
  panelCollapsed: boolean;
  panelSide: PanelSide;
  sidebarVisible: boolean;
  toolbarVisible: boolean;
  toolbarTabs: boolean;
  freezeBackgroundTabs: boolean;
  discardAfterMinutes: number;
  adBlocking: boolean;
  httpsOnly: boolean;
  blockThirdPartyCookies: boolean;
  secureDns: SecureDnsSetting;
  fontSize: FontSizeSetting;
  defaultZoom: number;
  pageLanguage: PageLanguage;
  welcomeCompleted: boolean;
}

export interface SettingsView {
  values: SettingsValues;
  defaultBrowser: boolean;
  engines: { id: SearchEngineId; label: string }[];
  customTemplateValid: boolean;
}

export type ClearDataRange = 'hour' | 'day' | 'week' | 'month' | 'all';

export interface ClearDataRequest {
  range: ClearDataRange;
  history: boolean;
  downloads: boolean;
  siteData: boolean;
  cache: boolean;
}

export const SettingsChannel = {
  get: 'yalqen-settings:get',
  update: 'yalqen-settings:update',
  changed: 'yalqen-settings:changed',
  clearData: 'yalqen-settings:clear-data',
  makeDefault: 'yalqen-settings:make-default',
} as const;

export interface SettingsApi {
  get(): Promise<SettingsView>;
  update(patch: Partial<SettingsValues>): Promise<SettingsView>;
  onChange(listener: (view: SettingsView) => void): () => void;
  clearData(request: ClearDataRequest): Promise<void>;
  makeDefault(): Promise<SettingsView>;
}
