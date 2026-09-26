import { randomUUID } from 'node:crypto';
import { WebContentsView, type BaseWindow, type Rectangle, type Session } from 'electron';
import { HISTORY_URL, NEW_TAB_URL, type BrowserState, type DeviceFrame, type DeviceId, type TabId, type TabSnapshot } from '../shared/types.js';
import { applyDeviceMetrics, applyEmulation, clearEmulation, deviceSize, findDevice, type Emulation } from './devices.js';
import type { SavedHistory, SavedSession, SavedTab } from './persistence.js';

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
}

export interface RecentPage {
  url: string;
  title: string;
  faviconUrl: string | null;
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

  state(): Pick<BrowserState, 'tabs' | 'activeTabId' | 'device'> {
    return {
      tabs: this.tabs.map((tab) => this.snapshot(tab)),
      activeTabId: this.activeId,
      device: this.deviceFrame(),
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

  open(url = NEW_TAB_URL, { activate = true } = {}): TabId {
    const tab = this.createRecord({ url });
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

    this.closed.push(this.toSaved(tab));
    if (this.closed.length > MAX_CLOSED_TABS) this.closed.shift();
    this.destroyView(tab);

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
    const existing = this.tabs.find((tab) => tab.url.startsWith(HISTORY_URL));
    if (existing) this.activate(existing.id);
    else this.open(HISTORY_URL);
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

  toSession(): SavedSession {
    return {
      version: 1,
      activeTabId: this.activeId,
      tabs: this.tabs.map((tab) => this.toSaved(tab)),
    };
  }

  destroyAll(): void {
    for (const tab of this.tabs) this.destroyView(tab);
  }

  private createRecord(saved: Partial<SavedTab> & { url: string }): Tab {
    return {
      id: saved.id ?? randomUUID(),
      view: null,
      url: saved.url,
      title: saved.title ?? NEW_TAB_TITLE,
      faviconUrl: saved.faviconUrl ?? null,
      keepAlive: saved.keepAlive ?? false,
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
        session: this.options.session,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    // Only Yalqen's own new tab is transparent. External pages retain a solid
    // view background, including while they are loading or render no body color.
    view.setBackgroundColor(tab.url === NEW_TAB_URL ? '#00000000' : '#ffffff');
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

    contents.on('enter-html-full-screen', () => this.options.onHtmlFullScreenChange(tab.id, true));
    contents.on('leave-html-full-screen', () => this.options.onHtmlFullScreenChange(tab.id, false));

    contents.on('will-navigate', (event) => {
      const search = event.url === NEW_TAB_SEARCH_URL || event.url.startsWith(`${NEW_TAB_SEARCH_URL}?`);
      const forget = event.url.startsWith(`${NEW_TAB_FORGET_URL}?`);
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
    contents.setWindowOpenHandler(({ url }) => {
      this.open(url);
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
    });
    contents.on('devtools-closed', () => this.maybeFreeze(tab));
    const updateUrl = () => {
      tab.url = contents.getURL();
      tab.visitId = this.options.onVisit(tab.url, tab.url);
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
