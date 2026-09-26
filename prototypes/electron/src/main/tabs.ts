import { randomUUID } from 'node:crypto';
import { WebContentsView, type BaseWindow, type ContextMenuParams, type Rectangle, type Session, type WebContents } from 'electron';
import { BOOKMARKS_URL, DOWNLOADS_URL, HISTORY_URL, INTERNAL_SCHEME, NEW_TAB_URL, type CommandPage, type BrowserState, type DeviceFrame, type DeviceId, type FindResult, type TabId, type TabSnapshot } from '../shared/types.js';
import { applyDeviceMetrics, applyEmulation, clearEmulation, deviceSize, findDevice, type Emulation } from './devices.js';
import type { SavedHistory, SavedSession, SavedTab } from './persistence.js';
import { PROCEED_URL } from './certificates.js';
import { ERR_ABORTED, errorPageScript, isCertificateError } from './error-page.js';
import { isActivation, mayOpenWindow, recordBlocked } from './popups.js';
import { securityState } from './site-info.js';
import { stepZoom } from './zoom.js';

const MAX_CLOSED_TABS = 20;
/** Links on the new tab page handled here instead of navigating: open the address bar, forget a recent page. */
const NEW_TAB_SEARCH_URL = `${NEW_TAB_URL}search`;
const NEW_TAB_FORGET_URL = `${NEW_TAB_URL}forget`;
const NEW_TAB_TITLE = 'Yeni sekme';
/** Space kept around an emulated device for the bezel and label drawn by the UI. */
const DEVICE_MARGIN = 32;
const DEVICE_LABEL_HEIGHT = 24;
const MIN_DEVICE_SCALE = 0.25;

interface Tab {
  id: TabId;
  /** Null while the tab is discarded: listed, but no page in memory. */
  view: WebContentsView | null;
  url: string;
  title: string;
  faviconUrl: string | null;
  keepAlive: boolean;
  /** Kept while the tab is discarded, so a reloaded page stays muted. Not persisted. */
  muted: boolean;
  /**
   * Uses the in-memory private session. Private tabs record no history and are
   * left out of the saved session and the recently closed list.
   */
  isPrivate: boolean;
  /** The page failed to load and shows an error page instead. */
  failed: boolean;
  /** Time of the last click or key press in the page; 0 once used to open a window. */
  activatedAt: number;
  /** Addresses of windows the current page was not allowed to open. */
  blockedPopups: string[];
  loading: boolean;
  /** Live page frozen in the background: no JS, timers or rendering until selected again. */
  frozen: boolean;
  /** Navigation history kept while the tab is discarded. */
  history: SavedHistory | null;
  /** Set while the tab is shown as a device. Not persisted. */
  emulation: Emulation | null;
  visitId: string | null;
}

export interface TabManagerOptions {
  window: BaseWindow;
  session: Session;
  /** In-memory session of private tabs. */
  privateSession: Session;
  /** The last private tab was closed. */
  onPrivateEnded: () => void;
  /** Whether background pages are frozen; read each time a tab could be frozen. */
  freezeBackground: () => boolean;
  /** A visible change may also require the saved session to be updated. */
  onChange: (persist: boolean) => void;
  /** The new tab page asked for the address bar. */
  /** A search typed on the new tab page, or empty when it asked for the address bar. */
  onNewTabSearch: (query: string) => void;
  onHtmlFullScreenChange: (tabId: TabId, fullScreen: boolean) => void;
  onVisit: (url: string, title: string) => string | null;
  onVisitTitle: (id: string | null, title: string) => void;
  onHistoryDelete: (id: string) => void;
  onHistoryClear: () => void;
  /** Match counts of a search in the active tab. */
  onFindResult: (result: FindResult) => void;
  /** Remembered zoom factor for a page address. */
  zoomFor: (url: string, isPrivate: boolean) => number;
  /** The user zoomed the page at `url`. */
  onZoom: (url: string, factor: number, isPrivate: boolean) => void;
  /** Whether the user trusted an invalid certificate for `url`'s site. */
  hasCertificateException: (url: string) => boolean;
  /** Token that lets the warning page for `url` proceed with its rejected certificate. */
  certificateToken: (url: string) => string | null;
  /** The warning page for `url` asked to proceed; returns whether the certificate is now trusted. */
  onCertificateProceed: (token: string, url: string) => boolean;
  /** Whether the site of the page at `url` may open windows without a click. */
  popupsAllowed: (url: string, isPrivate: boolean) => boolean;
  /** A command link or form on the downloads or bookmarks page, such as `open` with an id. */
  onPageCommand: (page: CommandPage, command: string, params: URLSearchParams) => void;
  isBookmarked: (url: string) => boolean;
  /** A page was right-clicked. */
  onContextMenu: (contents: WebContents, params: ContextMenuParams) => void;
}

export interface RecentPage {
  url: string;
  title: string;
  faviconUrl: string | null;
}

const COMMAND_PAGES = new Set<string>(['downloads', 'bookmarks'] satisfies CommandPage[]);

/** A command addressed to an internal page, such as yalqen://bookmarks/rename?id=…; the page itself is not one. */
function pageCommand(url: string): { page: CommandPage; name: string; params: URLSearchParams } | null {
  if (!url.startsWith(`${INTERNAL_SCHEME}://`)) return null;
  try {
    const parsed = new URL(url);
    if (!COMMAND_PAGES.has(parsed.host) || parsed.pathname === '/') return null;
    return { page: parsed.host as CommandPage, name: parsed.pathname.slice(1), params: parsed.searchParams };
  } catch {
    return null;
  }
}

/** Owns tab records and their page views. Only the active tab's view is attached to the window. */
export class TabManager {
  private readonly tabs: Tab[] = [];
  private readonly closed: SavedTab[] = [];
  private activeId: TabId | null = null;
  private pageBounds: Rectangle = { x: 0, y: 0, width: 0, height: 0 };
  private pageRadius = 0;

  constructor(private readonly options: TabManagerOptions) {}

  get activeTabId(): TabId | null {
    return this.activeId;
  }

  get activeUrl(): string {
    return this.active()?.url ?? NEW_TAB_URL;
  }

  get liveCount(): number {
    return this.tabs.filter((tab) => tab.view).length;
  }

  get frozenCount(): number {
    return this.tabs.filter((tab) => tab.frozen).length;
  }

  get count(): number {
    return this.tabs.length;
  }

  /** Empties the recently closed list. */
  forgetAllClosed(): void {
    this.closed.length = 0;
  }

  /** Drops a page from the recently closed list; it can no longer be reopened. */
  forgetClosed(url: string): void {
    for (let i = this.closed.length - 1; i >= 0; i--) {
      if (this.closed[i].url === url) this.closed.splice(i, 1);
    }
  }

  /** Recently closed web pages, newest first, one per address. */
  recentlyClosed(limit = 5): RecentPage[] {
    const pages: RecentPage[] = [];
    for (const tab of [...this.closed].reverse()) {
      if (!/^https?:/.test(tab.url) || pages.some((page) => page.url === tab.url)) continue;
      pages.push({ url: tab.url, title: tab.title, faviconUrl: tab.faviconUrl });
      if (pages.length === limit) break;
    }
    return pages;
  }

  state(): Pick<BrowserState, 'tabs' | 'activeTabId' | 'device' | 'zoom'> {
    const contents = this.active()?.view?.webContents;
    return {
      tabs: this.tabs.map((tab) => this.snapshot(tab)),
      activeTabId: this.activeId,
      device: this.deviceFrame(),
      zoom: contents && !contents.isDestroyed() ? contents.getZoomFactor() : 1,
    };
  }

  setPageBounds(bounds: Rectangle): void {
    if (
      bounds.x === this.pageBounds.x && bounds.y === this.pageBounds.y &&
      bounds.width === this.pageBounds.width && bounds.height === this.pageBounds.height
    ) return;
    this.pageBounds = bounds;
    const tab = this.active();
    if (!tab?.view) return;
    this.layoutView(tab, tab.view, true);
    if (tab.emulation) this.changed();
  }

  /** Turns device emulation on with `deviceId`, or off, for the active tab. */
  toggleEmulation(deviceId: DeviceId): void {
    const tab = this.active();
    if (!tab) return;
    this.setEmulation(tab, tab.emulation ? null : { deviceId, landscape: false });
  }

  /** Shows the active tab as `deviceId`, keeping the orientation if already emulated. */
  selectDevice(deviceId: DeviceId): void {
    const tab = this.active();
    if (!tab) return;
    this.setEmulation(tab, { deviceId, landscape: tab.emulation?.landscape ?? false });
  }

  rotateDevice(): void {
    const tab = this.active();
    if (!tab?.emulation) return;
    this.setEmulation(tab, { ...tab.emulation, landscape: !tab.emulation.landscape });
  }

  setPageRadius(radius: number): void {
    if (radius === this.pageRadius) return;
    this.pageRadius = radius;
    for (const tab of this.tabs) {
      if (!tab.emulation) tab.view?.setBorderRadius(radius);
    }
  }

  open(url = NEW_TAB_URL, { activate = true, isPrivate = false } = {}): TabId {
    const tab = this.createRecord({ url }, isPrivate);
    const index = this.activeId ? this.indexOf(this.activeId) + 1 : this.tabs.length;
    this.tabs.splice(index, 0, tab);
    if (activate) {
      this.activate(tab.id);
    } else {
      this.ensureLive(tab);
      this.changed(true);
    }
    return tab.id;
  }

  activate(id: TabId): void {
    const next = this.find(id);
    if (!next) return;

    const previous = this.active();
    if (previous?.view && previous.id !== id) {
      this.options.window.contentView.removeChildView(previous.view);
    }

    this.activeId = id;
    if (previous && previous.id !== id) this.maybeFreeze(previous);
    const view = this.ensureLive(next);
    this.unfreeze(next);
    // The page area may have changed while the tab was in the background.
    this.layoutView(next, view);
    this.options.window.contentView.addChildView(view);
    // The new tab page has its own search field; a blank page leaves focus with the UI.
    if (next.url !== 'about:blank') view.webContents.focus();
    this.changed(true);
  }

  /** Gives focus back to the active page. Returns false for a new tab page or a discarded tab. */
  focusActive(): boolean {
    const tab = this.active();
    if (!tab?.view || tab.url === NEW_TAB_URL || tab.url === 'about:blank') return false;
    tab.view.webContents.focus();
    return true;
  }

  /** Focuses the existing search field on the new tab page. */
  focusNewTabSearch(): boolean {
    const tab = this.active();
    const view = tab?.view;
    if (!tab || !view || tab.url !== NEW_TAB_URL) return false;

    const focusInput = () => {
      if (tab.view !== view || tab.url !== NEW_TAB_URL || view.webContents.isDestroyed()) return;
      void view.webContents.executeJavaScript("document.getElementById('q')?.focus()").catch(() => {});
    };
    view.webContents.focus();
    if (view.webContents.isLoadingMainFrame()) view.webContents.once('did-finish-load', focusInput);
    else focusInput();
    return true;
  }

  close(id: TabId): void {
    const index = this.indexOf(id);
    if (index < 0) return;
    const [tab] = this.tabs.splice(index, 1);

    if (!tab.isPrivate) {
      this.closed.push(this.toSaved(tab));
      if (this.closed.length > MAX_CLOSED_TABS) this.closed.shift();
    }
    this.destroyView(tab);
    if (tab.isPrivate && !this.tabs.some((item) => item.isPrivate)) this.options.onPrivateEnded();

    if (this.activeId === id) {
      this.activeId = null;
      const neighbor = this.tabs[Math.min(index, this.tabs.length - 1)];
      if (neighbor) {
        this.activate(neighbor.id);
      } else {
        this.open();
      }
      return;
    }
    this.changed(true);
  }

  reopenClosed(): void {
    const saved = this.closed.pop();
    if (!saved) return;
    const tab = this.createRecord(saved);
    const index = this.activeId ? this.indexOf(this.activeId) + 1 : this.tabs.length;
    this.tabs.splice(index, 0, tab);
    this.activate(tab.id);
  }

  move(id: TabId, toIndex: number): void {
    const from = this.indexOf(id);
    if (from < 0) return;
    const [tab] = this.tabs.splice(from, 1);
    const target = Math.max(0, Math.min(toIndex, this.tabs.length));
    this.tabs.splice(target, 0, tab);
    this.changed(true);
  }

  /** Releases the page but keeps the tab and its history. The active tab is never discarded. */
  discard(id: TabId): boolean {
    const tab = this.find(id);
    if (!tab?.view || id === this.activeId) return false;
    tab.history = this.captureHistory(tab);
    this.destroyView(tab);
    this.changed(true);
    return true;
  }

  discardBackground(): number {
    let count = 0;
    for (const tab of this.tabs) {
      if (!tab.keepAlive && this.discard(tab.id)) count++;
    }
    return count;
  }

  toggleKeepAlive(id: TabId): void {
    const tab = this.find(id);
    if (!tab) return;
    tab.keepAlive = !tab.keepAlive;
    if (tab.keepAlive) this.unfreeze(tab);
    else this.maybeFreeze(tab);
    this.changed(true);
  }

  /** Windows the active page was not allowed to open. */
  blockedPopups(): string[] {
    return [...(this.active()?.blockedPopups ?? [])];
  }

  /** Opens a window the active page was not allowed to open, next to it. */
  openBlockedPopup(url: string): void {
    const tab = this.active();
    if (!tab) return;
    tab.blockedPopups = tab.blockedPopups.filter((item) => item !== url);
    this.open(url, { isPrivate: tab.isPrivate });
  }

  clearBlockedPopups(): void {
    const tab = this.active();
    if (!tab || tab.blockedPopups.length === 0) return;
    tab.blockedPopups = [];
    this.changed();
  }

  toggleMute(id: TabId): void {
    const tab = this.find(id);
    if (!tab) return;
    tab.muted = !tab.muted;
    tab.view?.webContents.setAudioMuted(tab.muted);
    this.changed();
  }

  navigate(url: string): void {
    const tab = this.active();
    if (!tab) return;
    if (!tab.view && tab.emulation) {
      // The page load is deferred until the device is applied; load the new address instead.
      tab.url = url;
      tab.history = null;
      this.ensureLive(tab);
      return;
    }
    void this.ensureLive(tab).webContents.loadURL(url);
  }

  openHistory(): void {
    this.openSingle(HISTORY_URL);
  }

  openDownloads(): void {
    this.openSingle(DOWNLOADS_URL);
  }

  openBookmarks(): void {
    this.openSingle(BOOKMARKS_URL);
  }

  /** Address and title of the active page. */
  activePage(): { url: string; title: string } | null {
    const tab = this.active();
    return tab ? { url: tab.url, title: tab.title } : null;
  }

  /**
   * Reloads open pages whose address starts with `prefix`, such as the downloads
   * list. Deferred, so a command link the page just used has finished being cancelled.
   */
  reloadPages(prefix: string): void {
    setImmediate(() => {
      for (const tab of this.tabs) {
        const contents = tab.view?.webContents;
        if (contents && !contents.isDestroyed() && tab.url.startsWith(prefix)) contents.reload();
      }
    });
  }

  /** Selects the tab showing `url`, or opens one. */
  private openSingle(url: string): void {
    const existing = this.tabs.find((tab) => tab.url.startsWith(url));
    if (existing) this.activate(existing.id);
    else this.open(url);
  }

  goBack(): void {
    const history = this.active()?.view?.webContents.navigationHistory;
    if (history?.canGoBack()) history.goBack();
  }

  goForward(): void {
    const history = this.active()?.view?.webContents.navigationHistory;
    if (history?.canGoForward()) history.goForward();
  }

  reload(): void {
    this.active()?.view?.webContents.reload();
  }

  stop(): void {
    this.active()?.view?.webContents.stop();
  }

  /** Zooms the active page one step in (1) or out (-1), or back to actual size (0). */
  zoom(direction: 1 | -1 | 0): void {
    const tab = this.active();
    if (tab?.view) this.zoomView(tab, tab.view, direction);
  }

  /** Searches the active page; `next` moves within the current matches instead of starting over. */
  findInPage(text: string, forward: boolean, next: boolean): void {
    const contents = this.active()?.view?.webContents;
    if (!contents) return;
    if (text === '') {
      contents.stopFindInPage('clearSelection');
      this.options.onFindResult({ active: 0, matches: 0 });
      return;
    }
    contents.findInPage(text, { forward, findNext: !next });
  }

  /** Ends a search in `id`, keeping the active match selected. */
  stopFind(id: TabId): void {
    const contents = this.find(id)?.view?.webContents;
    if (contents && !contents.isDestroyed()) contents.stopFindInPage('keepSelection');
  }

  /** Applies the freeze setting to the current background tabs. */
  applyFreezeSetting(): void {
    for (const tab of this.tabs) {
      if (this.options.freezeBackground()) this.maybeFreeze(tab);
      else this.unfreeze(tab);
    }
    this.changed();
  }

  toggleDevTools(): void {
    this.active()?.view?.webContents.toggleDevTools();
  }

  selectByIndex(index: number): void {
    const tab = index < 0 ? this.tabs.at(-1) : this.tabs[index];
    if (tab) this.activate(tab.id);
  }

  /** Selects the tab `offset` places from the active one, wrapping at either end. */
  selectRelative(offset: number): void {
    if (this.tabs.length < 2 || !this.activeId) return;
    const count = this.tabs.length;
    const index = (((this.indexOf(this.activeId) + offset) % count) + count) % count;
    this.activate(this.tabs[index].id);
  }

  /** Restores a saved session with every tab discarded, then loads only the active one. */
  restore(session: SavedSession): void {
    for (const saved of session.tabs) {
      this.tabs.push(this.createRecord(saved));
    }
    const active = session.activeTabId ? this.find(session.activeTabId) : this.tabs[0];
    if (active) {
      this.activate(active.id);
    } else {
      this.open();
    }
  }

  /** Tabs to restore next time; private tabs are left out. */
  toSession(): SavedSession {
    const kept = this.tabs.filter((tab) => !tab.isPrivate);
    return {
      version: 1,
      activeTabId: kept.some((tab) => tab.id === this.activeId) ? this.activeId : (kept[0]?.id ?? null),
      tabs: kept.map((tab) => this.toSaved(tab)),
    };
  }

  get activeIsPrivate(): boolean {
    return this.active()?.isPrivate ?? false;
  }

  /** Whether `contents` is the page of a private tab. */
  isPrivateContents(contents: WebContents): boolean {
    return this.tabs.some((tab) => tab.isPrivate && tab.view?.webContents === contents);
  }

  destroyAll(): void {
    for (const tab of this.tabs) this.destroyView(tab);
  }

  private createRecord(saved: Partial<SavedTab> & { url: string }, isPrivate = false): Tab {
    return {
      id: saved.id ?? randomUUID(),
      view: null,
      url: saved.url,
      title: saved.title ?? NEW_TAB_TITLE,
      faviconUrl: saved.faviconUrl ?? null,
      keepAlive: saved.keepAlive ?? false,
      muted: false,
      isPrivate,
      failed: false,
      activatedAt: 0,
      blockedPopups: [],
      loading: false,
      frozen: false,
      history: saved.history ?? null,
      emulation: null,
      visitId: null,
    };
  }

  private ensureLive(tab: Tab): WebContentsView {
    if (tab.view) return tab.view;

    const view = new WebContentsView({
      webPreferences: {
        session: tab.isPrivate ? this.options.privateSession : this.options.session,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    // Only Yalqen's own new tab is transparent. External pages retain a solid
    // view background, including while they are loading or render no body color.
    view.setBackgroundColor(tab.url === NEW_TAB_URL ? '#00000000' : '#ffffff');
    if (tab.muted) view.webContents.setAudioMuted(true);
    tab.view = view;
    // Background tabs get real bounds too, so they lay out like visible pages.
    this.attachListeners(tab, view);
    const emulated = this.layoutView(tab, view);
    if (emulated) {
      // Load only after the device overrides are in place, so the first request
      // already carries the device user agent.
      void emulated.then(() => {
        if (tab.view === view) this.load(tab, view);
      });
    } else {
      this.load(tab, view);
    }
    return view;
  }

  private load(tab: Tab, view: WebContentsView): void {
    const history = tab.history;
    tab.history = null;
    const contents = view.webContents;
    if (history && history.entries.length > 0) {
      contents.navigationHistory
        .restore({ entries: history.entries, index: history.index })
        .catch(() => {
          // The promise also rejects when a later navigation (e.g. going back
          // right after restore) aborts the load; fall back only if nothing was restored.
          if (tab.view === view && !contents.isDestroyed() && contents.navigationHistory.length() === 0) {
            void contents.loadURL(tab.url);
          }
        });
    } else {
      void contents.loadURL(tab.url);
    }
  }

  private zoomView(tab: Tab, view: WebContentsView, direction: 1 | -1 | 0): void {
    const contents = view.webContents;
    const factor = direction === 0 ? 1 : stepZoom(contents.getZoomFactor(), direction);
    // Chromium applies the factor to every page of the same host in this session.
    contents.setZoomFactor(factor);
    this.options.onZoom(contents.getURL(), factor, tab.isPrivate);
    this.changed();
  }

  private setEmulation(tab: Tab, emulation: Emulation | null): void {
    const wasEmulated = tab.emulation !== null;
    tab.emulation = emulation;
    const view = tab.view;
    if (view) {
      const applied = emulation ? this.layoutView(tab, view) : this.clearDevice(tab, view);
      void (applied ?? Promise.resolve()).then(() => {
        // Reload when switching between desktop and device so the server
        // also sees the new user agent. Rotation and device changes do not reload.
        const contents = view.webContents;
        if (wasEmulated !== (emulation !== null) && !contents.isDestroyed() && contents.getURL() !== '') {
          contents.reload();
        }
      });
    }
    this.changed();
  }

  private clearDevice(tab: Tab, view: WebContentsView): Promise<void> {
    this.layoutView(tab, view);
    return clearEmulation(view.webContents).catch((error: unknown) => {
      console.warn('[emulation] could not clear device overrides:', error);
    });
  }

  /**
   * Sizes the view for the page area and applies the tab's device overrides.
   * Returns a promise only when a device is applied.
   */
  private layoutView(tab: Tab, view: WebContentsView, metricsOnly = false): Promise<void> | null {
    if (!tab.emulation) {
      view.setBorderRadius(this.pageRadius);
      view.setBounds(this.pageBounds);
      return null;
    }
    const frame = this.fitDevice(tab.emulation);
    view.setBorderRadius(Math.round(frame.cornerRadius * frame.scale));
    view.setBounds({
      x: this.pageBounds.x + frame.x,
      y: this.pageBounds.y + frame.y,
      width: frame.viewWidth,
      height: frame.viewHeight,
    });
    const apply = metricsOnly ? applyDeviceMetrics : applyEmulation;
    return apply(view.webContents, tab.emulation, frame.scale).catch((error: unknown) => {
      console.warn('[emulation] could not apply device overrides:', error);
    });
  }

  /** Centers the device in the page area, scaled down to fit when needed. */
  private fitDevice(emulation: Emulation): DeviceFrame {
    const device = findDevice(emulation.deviceId);
    const { width, height } = deviceSize(emulation);
    const page = this.pageBounds;
    const availableWidth = page.width - 2 * DEVICE_MARGIN;
    const availableHeight = page.height - 2 * DEVICE_MARGIN - DEVICE_LABEL_HEIGHT;
    const scale = Math.max(MIN_DEVICE_SCALE, Math.min(1, availableWidth / width, availableHeight / height));
    const viewWidth = Math.round(width * scale);
    const viewHeight = Math.round(height * scale);
    return {
      label: device.label,
      width,
      height,
      scale,
      cornerRadius: device.cornerRadius,
      x: Math.round((page.width - viewWidth) / 2),
      y: DEVICE_LABEL_HEIGHT + Math.round((page.height - DEVICE_LABEL_HEIGHT - viewHeight) / 2),
      viewWidth,
      viewHeight,
    };
  }

  private deviceFrame(): DeviceFrame | null {
    const emulation = this.active()?.emulation;
    return emulation ? this.fitDevice(emulation) : null;
  }

  private attachListeners(tab: Tab, view: WebContentsView): void {
    const contents = view.webContents;

    contents.on('did-start-navigation', ({ url, isMainFrame, isSameDocument }) => {
      // Search and "forget" are intercepted by this view, so they must not
      // briefly turn the still-visible new tab into an opaque page.
      const intercepted = url.startsWith(NEW_TAB_SEARCH_URL) || url.startsWith(NEW_TAB_FORGET_URL);
      if (isMainFrame && !isSameDocument && !intercepted) {
        view.setBackgroundColor(url === NEW_TAB_URL ? '#00000000' : '#ffffff');
      }
    });

    contents.on('before-input-event', (_event, input) => {
      // Esc stops a loading page. It still reaches the page, which may use it too.
      const modifier = input.control || input.meta || input.alt || input.shift;
      if (input.type === 'keyDown' && input.key === 'Escape' && !modifier && tab.loading) contents.stop();
    });

    // Ctrl + wheel or trackpad pinch; Electron leaves zooming to the app.
    contents.on('zoom-changed', (_event, direction) => this.zoomView(tab, view, direction === 'in' ? 1 : -1));
    contents.on('did-navigate', (_event, url) => {
      // Chromium forgets zoom levels on restart; apply the remembered one.
      const factor = this.options.zoomFor(url, tab.isPrivate);
      if (Math.abs(contents.getZoomFactor() - factor) > 0.001) contents.setZoomFactor(factor);
    });

    contents.on('context-menu', (_event, params) => this.options.onContextMenu(contents, params));

    contents.on('found-in-page', (_event, result) => {
      if (tab.id !== this.activeId || result.matches === undefined) return;
      this.options.onFindResult({ active: result.activeMatchOrdinal ?? 0, matches: result.matches });
    });

    contents.on('enter-html-full-screen', () => this.options.onHtmlFullScreenChange(tab.id, true));
    contents.on('leave-html-full-screen', () => this.options.onHtmlFullScreenChange(tab.id, false));

    contents.on('will-navigate', (event) => {
      if (event.url.startsWith(PROCEED_URL)) {
        event.preventDefault();
        // The token only works on the warning page it was issued for.
        if (this.options.onCertificateProceed(event.url.slice(PROCEED_URL.length), contents.getURL())) {
          contents.reload();
        }
        return;
      }
      const search = event.url === NEW_TAB_SEARCH_URL || event.url.startsWith(`${NEW_TAB_SEARCH_URL}?`);
      const forget = event.url.startsWith(`${NEW_TAB_FORGET_URL}?`);
      const command = pageCommand(event.url);
      if (command) {
        event.preventDefault();
        // Only the page itself may use its commands.
        if (!contents.getURL().startsWith(`${INTERNAL_SCHEME}://${command.page}/`)) return;
        this.options.onPageCommand(command.page, command.name, command.params);
        return;
      }
      const historyDelete = event.url.startsWith(`${HISTORY_URL}delete?`);
      const historyClear = event.url === `${HISTORY_URL}clear`;
      if (historyDelete || historyClear) {
        event.preventDefault();
        if (!contents.getURL().startsWith(HISTORY_URL)) return;
        if (historyDelete) {
          this.options.onHistoryDelete(new URL(event.url).searchParams.get('id') ?? '');
          contents.reload();
        } else {
          this.options.onHistoryClear();
          void contents.loadURL(HISTORY_URL);
        }
        return;
      }
      if (!search && !forget) return;
      event.preventDefault();
      // Only the new tab page itself may use these links.
      if (contents.getURL() !== NEW_TAB_URL) return;
      if (search) {
        this.options.onNewTabSearch(new URL(event.url).searchParams.get('q') ?? '');
      } else {
        this.forgetClosed(new URL(event.url).searchParams.get('url') ?? '');
        contents.reload();
      }
    });
    contents.on('input-event', (_event, input) => {
      if (isActivation(input.type)) tab.activatedAt = Date.now();
    });
    contents.setWindowOpenHandler(({ url }) => {
      // Like Chromium's pop-up blocker: a click or key press lets the page open one window.
      if (mayOpenWindow(tab.activatedAt, Date.now(), this.options.popupsAllowed(contents.getURL(), tab.isPrivate))) {
        tab.activatedAt = 0;
        this.open(url, { isPrivate: tab.isPrivate });
      } else {
        tab.blockedPopups = recordBlocked(tab.blockedPopups, url);
        this.changed();
      }
      return { action: 'deny' };
    });
    contents.on('page-title-updated', (_event, title) => {
      if (tab.url === contents.getURL()) this.options.onVisitTitle(tab.visitId, title);
      if (tab.title === title) return;
      tab.title = title;
      this.changed(true);
    });
    contents.on('page-favicon-updated', (_event, favicons) => {
      const faviconUrl = favicons[0] ?? null;
      if (tab.faviconUrl === faviconUrl) return;
      tab.faviconUrl = faviconUrl;
      this.changed(true);
    });
    contents.on('did-start-loading', () => {
      tab.loading = true;
      this.changed();
    });
    contents.on('did-stop-loading', () => {
      tab.loading = false;
      this.options.onVisitTitle(tab.visitId, contents.getTitle());
      // Background tabs are frozen once loaded, not mid-load.
      this.maybeFreeze(tab);
      this.changed();
    });
    contents.on('audio-state-changed', ({ audible }) => {
      if (!audible) this.maybeFreeze(tab);
      this.changed();
    });
    contents.on('devtools-closed', () => this.maybeFreeze(tab));
    contents.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => {
      if (!isMainFrame || isSameDocument || tab.blockedPopups.length === 0) return;
      tab.blockedPopups = [];
      this.changed();
    });
    const updateUrl = () => {
      tab.url = contents.getURL();
      tab.failed = false;
      tab.visitId = tab.isPrivate ? null : this.options.onVisit(tab.url, tab.url);
      // Navigation history can change even when the URL stays the same.
      this.changed(true);
    };
    contents.debugger.on('detach', () => {
      // The protocol session ended (overrides are gone with it); drop the device
      // instead of showing stale bounds.
      if (tab.view !== view || !tab.emulation || contents.isDestroyed()) return;
      tab.emulation = null;
      this.layoutView(tab, view);
      this.changed();
    });
    contents.on('did-navigate', updateUrl);
    // A failed load commits Chromium's empty error document under the failed
    // address without a did-navigate; show that address and explain the error.
    let failure: string | null = null;
    contents.on('did-fail-load', (_event, code, name, url, isMainFrame) => {
      if (!isMainFrame || code === ERR_ABORTED) return;
      const token = isCertificateError(code) ? this.options.certificateToken(url) : null;
      failure = errorPageScript(code, name, url, token ? `${PROCEED_URL}${token}` : null);
      tab.url = url;
      tab.failed = true;
      // Nothing was visited; later title changes must not rename the previous page's visit.
      tab.visitId = null;
      this.changed(true);
    });
    contents.on('did-finish-load', () => {
      if (!failure) return;
      const script = failure;
      failure = null;
      void contents.executeJavaScript(script).catch(() => {});
    });
    contents.on('did-navigate-in-page', updateUrl);
    contents.on('render-process-gone', () => {
      // Keep the tab discarded instead of reloading, so a crashing page cannot
      // cause a reload loop. Selecting it again recreates it from history.
      tab.history = this.captureHistory(tab);
      setImmediate(() => {
        this.destroyView(tab);
        this.changed(true);
      });
    });
  }

  /** Freezes a background page unless it is loading, protected or still in use. */
  private maybeFreeze(tab: Tab): void {
    const contents = tab.view?.webContents;
    if (!contents || contents.isDestroyed() || tab.frozen || tab.loading) return;
    if (!this.options.freezeBackground() || tab.id === this.activeId || tab.keepAlive) return;
    // Playing audio or an open DevTools means the page is still in use.
    if (contents.isCurrentlyAudible() || contents.isDevToolsOpened()) return;
    tab.frozen = true;
    this.setLifecycleState(tab, 'frozen');
    this.changed();
  }

  private unfreeze(tab: Tab): void {
    if (!tab.frozen) return;
    tab.frozen = false;
    this.setLifecycleState(tab, 'active');
  }

  /** Page lifecycle has no Electron API; it goes through the page's DevTools protocol session. */
  private setLifecycleState(tab: Tab, state: 'frozen' | 'active'): void {
    const contents = tab.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    const failed = (error: unknown) => {
      console.warn(`[freeze] ${state} failed for ${tab.url}: ${(error as Error).message}`);
      if (state === 'frozen' && tab.frozen && tab.view?.webContents === contents) {
        tab.frozen = false;
        this.changed();
      }
    };
    try {
      if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
    } catch (error) {
      failed(error);
      return;
    }
    contents.debugger.sendCommand('Page.setWebLifecycleState', { state }).catch((error: unknown) => {
      if (!contents.isDestroyed()) failed(error);
    });
  }

  private captureHistory(tab: Tab): SavedHistory | null {
    const history = tab.view?.webContents.navigationHistory;
    if (!history) return tab.history;
    const entries = history.getAllEntries();
    return entries.length > 0 ? { entries, index: history.getActiveIndex() } : tab.history;
  }

  private destroyView(tab: Tab): void {
    const view = tab.view;
    if (!view) return;
    this.options.onHtmlFullScreenChange(tab.id, false);
    tab.view = null;
    tab.loading = false;
    tab.frozen = false;
    this.options.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }

  private toSaved(tab: Tab): SavedTab {
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.faviconUrl,
      keepAlive: tab.keepAlive,
      history: this.captureHistory(tab),
    };
  }

  private snapshot(tab: Tab): TabSnapshot {
    const history = tab.view?.webContents.navigationHistory;
    return {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      faviconUrl: tab.faviconUrl,
      live: tab.view !== null,
      frozen: tab.frozen,
      loading: tab.loading,
      keepAlive: tab.keepAlive,
      isPrivate: tab.isPrivate,
      bookmarked: this.options.isBookmarked(tab.url),
      // An error page is not the site: it gets no connection state, not even a lock.
      security: tab.failed ? 'local' : securityState(tab.url, this.options.hasCertificateException(tab.url)),
      blockedPopups: tab.blockedPopups.length,
      audible: tab.view !== null && !tab.view.webContents.isDestroyed() && tab.view.webContents.isCurrentlyAudible(),
      muted: tab.muted,
      canGoBack: history?.canGoBack() ?? false,
      canGoForward: history?.canGoForward() ?? false,
    };
  }

  private active(): Tab | undefined {
    return this.activeId ? this.find(this.activeId) : undefined;
  }

  private find(id: TabId): Tab | undefined {
    return this.tabs.find((tab) => tab.id === id);
  }

  private indexOf(id: TabId): number {
    return this.tabs.findIndex((tab) => tab.id === id);
  }

  private changed(persist = false): void {
    this.options.onChange(persist);
  }
}
