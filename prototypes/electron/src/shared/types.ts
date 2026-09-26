export type TabId = string;

/** Scheme for the browser's own pages, served from the tab session. */
export const INTERNAL_SCHEME = 'yalqen';
export const NEW_TAB_URL = 'yalqen://newtab/';
export const HISTORY_URL = 'yalqen://history/';
export const DOWNLOADS_URL = 'yalqen://downloads/';
export const BOOKMARKS_URL = 'yalqen://bookmarks/';
/** Internal pages whose links and forms are commands handled by the browser. */
export type CommandPage = 'downloads' | 'bookmarks';

export type SearchEngineId = 'google' | 'yandex' | 'duckduckgo' | 'bing' | 'brave' | 'ecosia' | 'custom';
export type ThemeSource = 'system' | 'light' | 'dark';
/**
 * `dangerous`: https with a certificate the user chose to trust after a warning.
 * `local`: the browser's own pages, files and data, which have no connection to show.
 */
export type SecurityState = 'secure' | 'insecure' | 'dangerous' | 'local';

/** Tab data exposed to the UI. A tab can exist without a live page. */
export interface TabSnapshot {
  id: TabId;
  title: string;
  url: string;
  faviconUrl: string | null;
  live: boolean;
  /** Live, but its page is frozen in the background (no JS, timers or animations). */
  frozen: boolean;
  loading: boolean;
  keepAlive: boolean;
  security: SecurityState;
  /** Private tab: in-memory session, no history, not restored. */
  isPrivate: boolean;
  bookmarked: boolean;
  /** New windows the page tried to open without a click or key press. */
  blockedPopups: number;
  /** The page is playing sound, muted or not. */
  audible: boolean;
  muted: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export type DeviceId = 'iphone-15' | 'iphone-se' | 'pixel-8' | 'ipad-mini';

/** Where the emulated device screen sits, relative to the page area. */
export interface DeviceFrame {
  label: string;
  /** Emulated size in CSS pixels. */
  width: number;
  height: number;
  /** Rendered size divided by emulated size; below 1 when the window is too small. */
  scale: number;
  cornerRadius: number;
  x: number;
  y: number;
  viewWidth: number;
  viewHeight: number;
}

/**
 * `glass`: the window is transparent over the system glass material and only the
 * page card is opaque. `opaque`: no glass view (other platforms, addon missing)
 * or the system "Reduce transparency" setting is on.
 */
export type WindowMaterial = 'glass' | 'opaque';

/** Which edge of the window the tab panel sits on. */
export type PanelSide = 'left' | 'right';

export interface BrowserState {
  tabs: TabSnapshot[];
  activeTabId: TabId | null;
  /** The active site's HTML full screen player occupies the whole window. */
  pageFullScreen: boolean;
  addressPlaceholder: string;
  panelCollapsed: boolean;
  panelSide: PanelSide;
  material: WindowMaterial;
  /** Set while the active tab is shown as a device. */
  device: DeviceFrame | null;
  /** Zoom factor of the active page; 1 is actual size. */
  zoom: number;
  downloads: DownloadsSummary;
}

/** Running downloads for the toolbar; `progress` is 0–1, or null when a size is unknown. */
export interface DownloadsSummary {
  active: number;
  progress: number | null;
}

/** Regions of the window reserved for the UI; the page view fills the rest. */
export interface ChromeLayout {
  /** Width of the sidebar, including its gap to the page card. */
  panelWidth: number;
  panelSide: PanelSide;
  /** Whether the macOS window controls are always shown; otherwise they appear while the pointer is over their corner. */
  windowControls: boolean;
  /** Height of the top bar above the page card. */
  chromeHeight: number;
  /** Gap between the page card and the right and bottom window edges. */
  pageInset: number;
  /** Corner radius of the page card. */
  pageRadius: number;
}

/** The macOS window controls were revealed or hidden again. */
export type UiCommand = { type: 'window-controls'; visible: boolean };

/** Requests the UI sends to the main process. */
export type UiAction =
  | { type: 'new-tab'; url?: string }
  | { type: 'activate-tab'; id: TabId }
  | { type: 'close-tab'; id: TabId }
  | { type: 'discard-tab'; id: TabId }
  | { type: 'toggle-keep-alive'; id: TabId }
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
  | { type: 'open-address' }
  | { type: 'open-profile-menu' }
  | { type: 'open-downloads' }
  | { type: 'open-history' }
  /** Shows the window controls while the pointer stays within `width` of the window's top-left corner. */
  | { type: 'reveal-window-controls'; width: number }
  | { type: 'open-settings' };

export const IpcChannel = {
  getState: 'yalqen:get-state',
  state: 'yalqen:state',
  command: 'yalqen:command',
  setLayout: 'yalqen:set-layout',
  action: 'yalqen:action',
} as const;

/** API exposed to the UI renderer by the preload script. */
export interface YalqenApi {
  getState(): Promise<BrowserState>;
  onState(listener: (state: BrowserState) => void): () => void;
  onCommand(listener: (command: UiCommand) => void): () => void;
  setLayout(layout: ChromeLayout): void;
  send(action: UiAction): void;
}

/** Sent to the command bar each time it opens. */
export interface CommandBarOpen {
  placeholder: string;
  mode: 'navigate' | 'new-tab';
  value?: string;
}

/** A page offered below the address bar; `tabId` is set for an open tab to switch to. */
export interface AddressSuggestion {
  kind: 'tab' | 'bookmark' | 'history';
  title: string;
  url: string;
  tabId?: TabId;
}

/** Suggestions for the text they were computed for. */
export interface CommandBarSuggestions {
  input: string;
  suggestions: AddressSuggestion[];
}

/** Requests the command bar sends to the main process. */
export type CommandBarAction =
  | { type: 'submit'; input: string }
  | { type: 'switch-tab'; id: TabId }
  | { type: 'dismiss' }
  /** The text changed; the bar stays open. */
  | { type: 'input'; input: string };

export const CommandBarChannel = {
  open: 'yalqen-command:open',
  suggestions: 'yalqen-command:suggestions',
  action: 'yalqen-command:action',
} as const;

/** API exposed to the command bar overlay by its preload script. */
export interface CommandBarApi {
  onOpen(listener: (open: CommandBarOpen) => void): () => void;
  onSuggestions(listener: (suggestions: CommandBarSuggestions) => void): () => void;
  send(action: CommandBarAction): void;
}

/** Match counts for the find bar; `active` is 0 when nothing matches. */
export interface FindResult {
  active: number;
  matches: number;
}

/** Requests the find bar sends to the main process. */
export type FindBarAction =
  /** `next` moves within the current matches instead of starting a new search. */
  | { type: 'find'; text: string; forward: boolean; next: boolean }
  | { type: 'close' };

export const FindBarChannel = {
  open: 'yalqen-find:open',
  result: 'yalqen-find:result',
  action: 'yalqen-find:action',
} as const;

/** API exposed to the find bar overlay by its preload script. */
export interface FindBarApi {
  onOpen(listener: () => void): () => void;
  onResult(listener: (result: FindResult) => void): () => void;
  send(action: FindBarAction): void;
}

/** User settings the settings window can change. */
export interface SettingsValues {
  searchEngine: SearchEngineId;
  /** Used when `searchEngine` is `custom`; `%s` marks the query. */
  customSearchTemplate: string | null;
  theme: ThemeSource;
  /** What to open when the browser starts again. */
  startupBehavior: 'restore' | 'new-tab';
  panelCollapsed: boolean;
  panelSide: PanelSide;
  /** Freeze background tabs' pages when switching away from them. */
  freezeBackgroundTabs: boolean;
  /** Block ads on web pages. */
  adBlocking: boolean;
  /** Whether the one-time first launch welcome has been dismissed. */
  welcomeCompleted: boolean;
}

export interface SettingsView {
  values: SettingsValues;
  /** Whether web links from other apps open in this browser. */
  defaultBrowser: boolean;
  engines: { id: SearchEngineId; label: string }[];
  customTemplateValid: boolean;
}

export type ClearDataRange = 'hour' | 'day' | 'week' | 'month' | 'all';

/** What to clear from the settings window. Site data and the cache are always cleared entirely. */
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

/** API exposed to the settings window by its preload script. */
export interface SettingsApi {
  get(): Promise<SettingsView>;
  update(patch: Partial<SettingsValues>): Promise<SettingsView>;
  onChange(listener: (view: SettingsView) => void): () => void;
  /** Resolves once the data is cleared. */
  clearData(request: ClearDataRequest): Promise<void>;
  /** Asks the system to open web links in this browser. */
  makeDefault(): Promise<SettingsView>;
}
