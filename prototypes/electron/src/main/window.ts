import fs from 'node:fs';
import path from 'node:path';
import { BaseWindow, Menu, WebContentsView, app, clipboard, dialog, nativeTheme, type Session } from 'electron';
import {
  NEW_TAB_URL,
  IpcChannel,
  type BrowserState,
  type ChromeLayout,
  type DeviceId,
  type UiAction,
  type WindowMaterial,
} from '../shared/types.js';
import { bookmarksMenuTemplate, type BookmarkStore } from './bookmarks.js';
import type { CertificateExceptions } from './certificates.js';
import { CommandBar } from './command-bar.js';
import { contextMenuTemplate } from './context-menu.js';
import { downloadsMenuTemplate, downloadsSummary, type DownloadActions, type DownloadStore } from './downloads.js';
import { FindBar } from './find-bar.js';
import { applyGlass, glassAvailable } from './glass.js';
import type { HistoryStore } from './history.js';
import type { HttpsOnly } from './https-only.js';
import { canViewSource, pdfFileName } from './page-export.js';
import { pageFrame } from './page-layout.js';
import { fontPreferences } from './page-preferences.js';
import { permissionOrigin, type PermissionStore } from './permissions.js';
import type { SavedTab, SavedWindow } from './persistence.js';
import { blockedPopupsTemplate } from './popups.js';
import { Preconnector } from './preconnect.js';
import { buildSearchUrl, type SearchEngine } from './search.js';
import type { SettingsStore } from './settings.js';
import type { SettingsWindow } from './settings-window.js';
import { siteInfoTemplate } from './site-info.js';
import { suggest } from './suggestions.js';
import { TabManager, type DetachedTab } from './tabs.js';
import { resolveInput } from './url.js';
import type { ZoomStore } from './zoom.js';

// Offset of the traffic lights from the top-left corner. Their 14pt buttons then
// share the 22px center line of the back and forward capsule.
const WINDOW_CONTROLS_INSET = { x: 16, y: 15 };
// A new window opens this far from the one it came from.
const CASCADE_OFFSET = 24;

/** What every window shares: sessions, stores and app-wide actions. */
export interface AppContext {
  icon: string;
  daily: Session;
  privateBrowsing: Session;
  settings: SettingsStore;
  settingsWindow: SettingsWindow;
  history: HistoryStore;
  downloads: DownloadStore;
  bookmarks: BookmarkStore;
  certificates: CertificateExceptions;
  httpsOnly: HttpsOnly;
  /** Recently closed tabs of all windows. */
  closedTabs: SavedTab[];
  permissionsFor(isPrivate: boolean): PermissionStore;
  zoomFor(isPrivate: boolean): ZoomStore;
  searchEngine(): SearchEngine;
  /** Download commands; "show all" opens the list in `window`. */
  downloadActions(window: YalqenWindow): DownloadActions;
  downloadsChanged(): void;
  toggleBookmark(url: string, title: string): void;
  runBookmarksCommand(command: string, params: URLSearchParams): void;
  runDownloadsCommand(command: string, params: URLSearchParams): void;
  updateSettings(patch: unknown): void;
  /** Device used by the phone view shortcut. */
  deviceId(): DeviceId;
  openWindow(options: WindowOptions): YalqenWindow;
  /** A window's tabs changed; `persist` asks for the saved session to be updated. */
  onWindowChange(persist: boolean): void;
  /** A window has no private tabs left. */
  onPrivateTabsClosed(): void;
  onWindowFocus(window: YalqenWindow): void;
  /** The window is closing; it is still listed and its tabs are still open. */
  onWindowClosing(window: YalqenWindow): void;
  onWindowClosed(window: YalqenWindow): void;
}

export interface WindowOptions {
  /** Every tab of a private window is private, and the window is not restored. */
  isPrivate?: boolean;
  /** Tabs to restore. */
  saved?: SavedWindow;
  /** Address of the first tab, instead of a new tab page. */
  url?: string;
  /** A tab moved from another window. */
  tab?: DetachedTab;
  /** Window it was opened from, to place the new one next to it. */
  from?: YalqenWindow;
}

/** One browser window: its tabs, toolbar, command bar and find bar. */
export class YalqenWindow {
  readonly window: BaseWindow;
  readonly tabs: TabManager;
  readonly isPrivate: boolean;
  private readonly ui: WebContentsView;
  private readonly commandBar: CommandBar;
  private readonly findBar: FindBar;
  private readonly preconnector: Preconnector;
  private layout: ChromeLayout = {
    panelWidth: 220,
    panelSide: 'left',
    chromeHeight: 44,
    pageInset: 8,
    pageRadius: 16,
  };
  // Optimistic until the glass view is added, so the UI does not start opaque.
  private glassApplied = glassAvailable;
  private htmlFullScreenTabId: string | null = null;
  // Tab and address (without fragment) the find bar searches; it closes when either changes.
  private findTarget: { tabId: string; url: string } | null = null;
  private lastNavigationGesture: { source: 'native' | 'page'; direction: 'back' | 'forward'; at: number } | null = null;

  constructor(
    private readonly app: AppContext,
    options: WindowOptions,
  ) {
    this.isPrivate = options.isPrivate ?? false;
    const from = options.from?.window.getBounds();
    this.window = new BaseWindow({
      width: from?.width ?? 1280,
      height: from?.height ?? 820,
      ...(from ? { x: from.x + CASCADE_OFFSET, y: from.y + CASCADE_OFFSET } : {}),
      minWidth: 640,
      minHeight: 400,
      title: this.isPrivate ? 'Yalqen (gizli)' : 'Yalqen',
      icon: app.icon,
      titleBarStyle: 'hiddenInset',
      // The glass view sits behind the UI, so the window itself must be see-through.
      transparent: glassAvailable,
    });

    this.ui = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    if (glassAvailable) this.ui.setBackgroundColor('#00000000');
    this.ui.webContents.on('will-navigate', (event) => event.preventDefault());
    this.ui.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.contentView.addChildView(this.ui);

    this.preconnector = new Preconnector((origin) =>
      (this.tabs.activeIsPrivate ? app.privateBrowsing : app.daily).preconnect({ url: origin }),
    );

    this.commandBar = new CommandBar({
      window: this.window,
      preload: path.join(__dirname, '../preload/command-preload.js'),
      page: path.join(__dirname, '../renderer/command.html'),
      onSubmit: (input, mode) => {
        this.preconnector.cancel();
        const url = resolveInput(input, app.searchEngine());
        if (mode === 'new-tab') this.tabs.open(url);
        else this.tabs.navigate(url);
      },
      onDismiss: () => {
        this.preconnector.cancel();
        if (!this.tabs.focusActive()) this.ui.webContents.focus();
      },
      onInput: (input) => {
        this.preconnector.typed(input, app.searchEngine());
        const open = this.tabs.state();
        this.commandBar.showSuggestions(
          input,
          suggest(input, {
            tabs: open.tabs.filter((tab) => tab.id !== open.activeTabId),
            bookmarks: app.bookmarks.bookmarks(),
            history: this.tabs.activeIsPrivate ? [] : app.history.list(),
          }),
        );
      },
      onSwitchTab: (id) => this.tabs.activate(id),
    });

    this.findBar = new FindBar({
      window: this.window,
      preload: path.join(__dirname, '../preload/find-preload.js'),
      page: path.join(__dirname, '../renderer/find.html'),
      onFind: (text, forward, next) => this.tabs.findInPage(text, forward, next),
      onClose: () => {
        if (this.findTarget) this.tabs.stopFind(this.findTarget.tabId);
        this.findTarget = null;
        if (!this.tabs.focusActive()) this.ui.webContents.focus();
      },
    });

    this.tabs = new TabManager({
      window: this.window,
      gesturePreload: path.join(__dirname, '../preload/page-gesture.js'),
      closed: app.closedTabs,
      privateWindow: this.isPrivate,
      session: app.daily,
      privateSession: app.privateBrowsing,
      onPrivateEnded: () => app.onPrivateTabsClosed(),
      freezeBackground: () => app.settings.get().freezeBackgroundTabs,
      onChange: (persist) => {
        if (this.htmlFullScreenTabId && this.htmlFullScreenTabId !== this.tabs.activeTabId) {
          this.htmlFullScreenTabId = null;
          this.syncPageFullScreen();
        }
        const target = this.findTarget;
        if (target && (target.tabId !== this.tabs.activeTabId || target.url !== pageAddress(this.tabs.activeUrl))) {
          this.endFind();
        }
        this.findBar.keepOnTop();
        this.commandBar.keepOnTop();
        this.pushState();
        app.onWindowChange(persist);
      },
      onPageSwipe: (direction) => this.navigateByGesture(direction, 'page'),
      onNewTabSearch: (query) => {
        if (query.trim() === '') this.openAddress();
        else this.tabs.navigate(resolveInput(query, app.searchEngine()));
      },
      onHtmlFullScreenChange: (tabId, fullScreen) => {
        if (fullScreen) {
          if (tabId !== this.tabs.activeTabId || this.htmlFullScreenTabId === tabId) return;
          this.htmlFullScreenTabId = tabId;
        } else {
          if (this.htmlFullScreenTabId !== tabId) return;
          this.htmlFullScreenTabId = null;
        }
        this.syncPageFullScreen();
      },
      onVisit: (url, title) => app.history.visit(url, title),
      onVisitTitle: (id, title) => app.history.setTitle(id, title),
      onHistoryDelete: (id) => app.history.remove(id),
      onHistoryClear: () => app.history.clear(),
      isBookmarked: (url) => app.bookmarks.find(url) !== undefined,
      onPageCommand: (page, command, params) => {
        if (page === 'bookmarks') app.runBookmarksCommand(command, params);
        else app.runDownloadsCommand(command, params);
      },
      onFindResult: (result) => this.findBar.showResult(result),
      zoomFor: (url, isPrivate) => app.zoomFor(isPrivate).get(url),
      defaultZoom: () => app.settings.get().defaultZoom,
      hasOwnZoom: (url, isPrivate) => app.zoomFor(isPrivate).has(url),
      pagePreferences: () => fontPreferences(app.settings.get().fontSize),
      onZoom: (url, factor, isPrivate) => app.zoomFor(isPrivate).set(url, factor),
      hasCertificateException: (url) => app.certificates.hasException(url),
      certificateToken: (url) => app.certificates.tokenFor(url),
      onCertificateProceed: (token, url) => app.certificates.proceed(token, url),
      popupsAllowed: (url, isPrivate) => {
        const origin = permissionOrigin(url);
        return origin !== null && app.permissionsFor(isPrivate).get(origin, 'popups') === 'allow';
      },
      upgradeHttp: (url) => app.httpsOnly.upgrade(url),
      httpsOnlyWarning: (https, http) => app.httpsOnly.warn(https, http),
      onProceedHttp: (token, currentUrl) => app.httpsOnly.proceed(token, currentUrl),
      confirmHttpRedirect: async (url) => {
        const { response } = await dialog.showMessageBox(this.window, {
          type: 'warning',
          message: 'Sayfa güvenli olmayan bir adrese yönlendiriyor',
          detail: `${new URL(url).host} HTTPS yerine HTTP ile açılmak istiyor. Bu sitedeki bilgileriniz şifrelenmeden gönderilir.`,
          buttons: ['Geri dön', 'HTTP ile devam et'],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        });
        if (response === 1) app.httpsOnly.allowHost(url);
        return response === 1;
      },
      onContextMenu: (contents, params) => this.showContextMenu(contents, params),
    });

    this.window.on('focus', () => app.onWindowFocus(this));
    if (process.platform === 'darwin') {
      this.window.on('swipe', (_event, direction) => {
        if (direction === 'right') this.navigateByGesture('back', 'native');
        else if (direction === 'left') this.navigateByGesture('forward', 'native');
      });
    }
    this.window.on('resize', () => this.applyLayout());
    this.window.on('enter-full-screen', () => this.applyLayout());
    this.window.on('leave-full-screen', () => this.applyLayout());
    this.applyLayout();

    // "Reduce transparency" can change while the app runs; the UI then paints opaque.
    nativeTheme.on('updated', this.pushState);
    this.ui.webContents.once('did-finish-load', () => {
      this.glassApplied = applyGlass(this.window);
      this.pushState();
    });

    this.window.on('close', () => {
      app.onWindowClosing(this);
      nativeTheme.off('updated', this.pushState);
      const hadPrivate = this.tabs.hasPrivateTabs;
      this.tabs.destroyAll();
      this.commandBar.destroy();
      this.findBar.destroy();
      if (!this.ui.webContents.isDestroyed()) this.ui.webContents.close();
      app.onWindowClosed(this);
      if (hadPrivate) app.onPrivateTabsClosed();
    });

    if (options.tab) this.tabs.adopt(options.tab);
    else if (options.saved && options.saved.tabs.length > 0) this.tabs.restore(options.saved);
    else this.tabs.open(options.url);

    void this.ui.webContents.loadFile(path.join(__dirname, '../renderer/index.html'));
    app.onWindowFocus(this);
  }

  private navigateByGesture(direction: 'back' | 'forward', source: 'native' | 'page'): void {
    if (process.platform !== 'darwin') return;
    // Some macOS settings deliver both the native swipe and horizontal wheel
    // stream for one movement. Let only the first source navigate it.
    const now = Date.now();
    const last = this.lastNavigationGesture;
    if (last && last.source !== source && last.direction === direction && now - last.at < 650) return;
    this.lastNavigationGesture = { source, direction, at: now };
    if (direction === 'back') this.tabs.goBack();
    else this.tabs.goForward();
  }

  /** The toolbar and sidebar page of this window. */
  get uiContents(): Electron.WebContents {
    return this.ui.webContents;
  }

  isFocused(): boolean {
    return !this.window.isDestroyed() && this.window.isFocused();
  }

  focus(): void {
    if (!this.window.isDestroyed()) this.window.focus();
  }

  readonly pushState = (): void => {
    if (!this.ui.webContents.isDestroyed()) {
      this.ui.webContents.send(IpcChannel.state, this.state());
    }
  };

  state(): BrowserState {
    return {
      ...this.tabs.state(),
      pageFullScreen: this.isPageFullScreen(),
      addressPlaceholder: this.app.searchEngine().placeholder,
      panelCollapsed: this.app.settings.get().panelCollapsed,
      panelSide: this.app.settings.get().panelSide,
      sidebarVisible: this.app.settings.get().sidebarVisible,
      toolbarVisible: this.app.settings.get().toolbarVisible,
      material: this.material(),
      defaultZoom: this.app.settings.get().defaultZoom,
      downloads: downloadsSummary(this.app.downloads.list()),
    };
  }

  setLayout(layout: ChromeLayout): void {
    this.layout = layout;
    this.applyLayout();
  }

  /** Opens the centered address bar with the current address selected. */
  openAddress(): void {
    const url = this.tabs.activeUrl;
    this.preconnector.opened(this.app.searchEngine());
    this.commandBar.open({
      placeholder: this.app.searchEngine().placeholder,
      mode: 'navigate',
      value: url === NEW_TAB_URL || url === 'about:blank' ? '' : url,
    });
  }

  /** Opens the find bar, or moves to the next or previous match when `forward` is set. */
  openFind(forward?: boolean): void {
    if (this.isPageFullScreen() || !this.tabs.activeTabId) return;
    this.commandBar.close();
    this.findTarget = { tabId: this.tabs.activeTabId, url: pageAddress(this.tabs.activeUrl) };
    if (forward === undefined) this.findBar.open();
    else this.findBar.findNext(forward);
  }

  print(contents = this.tabs.activeContents()): void {
    contents?.print({}, (success, reason) => {
      if (!success && reason !== 'Print job canceled' && reason !== 'cancelled') {
        console.warn(`[print] could not print: ${reason}`);
      }
    });
  }

  async savePageAsPdf(): Promise<void> {
    const contents = this.tabs.activeContents();
    if (!contents) return;
    const { canceled, filePath } = await dialog.showSaveDialog(this.window, {
      title: 'PDF olarak kaydet',
      defaultPath: path.join(app.getPath('downloads'), pdfFileName(contents.getTitle(), contents.getURL())),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath || contents.isDestroyed()) return;
    try {
      await fs.promises.writeFile(filePath, await contents.printToPDF({ printBackground: true }));
    } catch (error) {
      console.warn('[print] could not save the page as PDF:', error);
      void dialog.showMessageBox(this.window, {
        type: 'error',
        message: 'Sayfa PDF olarak kaydedilemedi.',
        detail: String(error),
      });
    }
  }

  /** Moves the active tab into a new window; the last tab of a window stays. */
  moveActiveTabToNewWindow(): void {
    const id = this.tabs.activeTabId;
    const tab = id ? this.tabs.detach(id) : null;
    if (tab) this.app.openWindow({ tab, isPrivate: this.isPrivate, from: this });
  }

  close(): void {
    if (!this.window.isDestroyed()) this.window.close();
  }

  handleAction(action: UiAction): void {
    const tabs = this.tabs;
    const app = this.app;
    switch (action.type) {
      case 'new-tab':
        tabs.open(action.url);
        break;
      case 'activate-tab':
        tabs.activate(action.id);
        break;
      case 'close-tab':
        tabs.close(action.id);
        break;
      case 'discard-tab':
        tabs.discard(action.id);
        break;
      case 'toggle-keep-alive':
        tabs.toggleKeepAlive(action.id);
        break;
      case 'toggle-mute':
        tabs.toggleMute(action.id);
        break;
      case 'move-tab':
        tabs.move(action.id, action.toIndex);
        break;
      case 'navigate':
        tabs.navigate(resolveInput(action.input, app.searchEngine()));
        break;
      case 'go-back':
        tabs.goBack();
        break;
      case 'go-forward':
        tabs.goForward();
        break;
      case 'reload':
        tabs.reload();
        break;
      case 'stop':
        tabs.stop();
        break;
      case 'reset-zoom':
        tabs.zoom(0);
        break;
      case 'open-blocked-popups': {
        const origin = permissionOrigin(tabs.activeUrl);
        const blocked = tabs.blockedPopups();
        if (!origin || blocked.length === 0) break;
        const template = blockedPopupsTemplate(new URL(origin).host, blocked, {
          open: (url) => tabs.openBlockedPopup(url),
          allowSite: () => {
            app.permissionsFor(tabs.activeIsPrivate).set(origin, ['popups'], 'allow');
            tabs.clearBlockedPopups();
          },
        });
        this.popup(template);
        break;
      }
      case 'open-site-info': {
        const tab = tabs.state().tabs.find((item) => item.id === tabs.activeTabId);
        if (!tab) break;
        const origin = permissionOrigin(tab.url);
        const store = app.permissionsFor(tab.isPrivate);
        const template = siteInfoTemplate(
          { url: tab.url, security: tab.security, permissions: origin ? store.list(origin) : [] },
          {
            setPermission: (kind, decision) => {
              if (origin) store.set(origin, [kind], decision);
            },
            revokeCertificateException: () => {
              app.certificates.revoke(tab.url);
              // Open connections were already accepted; new ones check the certificate again.
              const browsing = tab.isPrivate ? app.privateBrowsing : app.daily;
              void browsing.closeAllConnections().then(() => tabs.reload());
            },
          },
        );
        this.popup(template);
        break;
      }
      case 'toggle-panel':
        app.updateSettings({ panelCollapsed: !app.settings.get().panelCollapsed });
        break;
      case 'toggle-sidebar':
        app.updateSettings({ sidebarVisible: !app.settings.get().sidebarVisible });
        break;
      case 'open-address':
        this.openAddress();
        break;
      case 'open-profile-menu':
        this.popup([
          { label: 'Yalqen profili', enabled: false },
          { type: 'separator' },
          { label: 'Yeni pencere', click: () => app.openWindow({ from: this }) },
          { label: 'Yeni gizli pencere', click: () => app.openWindow({ isPrivate: true, from: this }) },
          { label: 'Yeni gizli sekme', click: () => tabs.open(NEW_TAB_URL, { isPrivate: true }) },
          { type: 'separator' },
          { label: 'Ayarlar…', click: () => app.settingsWindow.open() },
        ]);
        break;
      case 'toggle-bookmark': {
        const page = tabs.activePage();
        if (page) app.toggleBookmark(page.url, page.title);
        break;
      }
      case 'open-bookmarks-menu': {
        const template = bookmarksMenuTemplate(app.bookmarks.folders(), app.bookmarks.bookmarks(), {
          open: (url) => tabs.navigate(url),
          showAll: () => tabs.openBookmarks(),
        });
        this.popup(template);
        break;
      }
      case 'open-downloads':
        this.popup(downloadsMenuTemplate(app.downloads.list(), app.downloadActions(this)));
        break;
      case 'open-history':
        tabs.openHistory();
        break;
      case 'open-settings':
        app.settingsWindow.open();
        break;
    }
  }

  private popup(template: Electron.MenuItemConstructorOptions[]): void {
    Menu.buildFromTemplate(template).popup({ window: this.window });
  }

  private showContextMenu(contents: Electron.WebContents, params: Electron.ContextMenuParams): void {
    const tabs = this.tabs;
    const history = contents.navigationHistory;
    const isPrivate = tabs.isPrivateContents(contents);
    const template = contextMenuTemplate(params, {
      canGoBack: history.canGoBack(),
      canGoForward: history.canGoForward(),
      canViewSource: canViewSource(contents.getURL()),
      // Like other browsers, links open next to the page without leaving it.
      openInNewTab: (url) => tabs.open(url, { activate: false, isPrivate }),
      openInNewWindow: (url) => this.app.openWindow({ url, isPrivate, from: this }),
      copyText: (text) => clipboard.writeText(text),
      copyImage: () => contents.copyImageAt(params.x, params.y),
      download: (url) => contents.downloadURL(url),
      search: (text) => tabs.open(buildSearchUrl(this.app.searchEngine(), text), { isPrivate }),
      goBack: () => history.goBack(),
      goForward: () => history.goForward(),
      reload: () => contents.reload(),
      inspect: () => contents.inspectElement(params.x, params.y),
      print: () => this.print(contents),
      viewSource: () => {
        if (canViewSource(contents.getURL())) tabs.open(`view-source:${contents.getURL()}`, { isPrivate });
      },
      replaceMisspelling: (word) => contents.replaceMisspelling(word),
      addToDictionary: (word) => contents.session.addWordToSpellCheckerDictionary(word),
    });
    this.popup(template);
  }

  private material(): WindowMaterial {
    return this.glassApplied && !nativeTheme.prefersReducedTransparency ? 'glass' : 'opaque';
  }

  private isPageFullScreen(): boolean {
    return this.htmlFullScreenTabId !== null && this.htmlFullScreenTabId === this.tabs.activeTabId;
  }

  private endFind(): void {
    if (this.findTarget) this.tabs.stopFind(this.findTarget.tabId);
    this.findTarget = null;
    this.findBar.close();
  }

  private syncPageFullScreen(): void {
    if (this.isPageFullScreen()) {
      this.commandBar.close();
      this.endFind();
    }
    this.applyLayout();
    this.pushState();
  }

  // macOS moves the controls into its own title bar in full screen.
  private showWindowControls(): void {
    this.window.setWindowButtonVisibility(true);
    if (!this.window.isFullScreen()) this.window.setWindowButtonPosition(WINDOW_CONTROLS_INSET);
  }

  private applyLayout(): void {
    const { width, height } = this.window.getContentBounds();
    this.ui.setBounds({ x: 0, y: 0, width, height });
    this.commandBar.fitWindow();
    const { radius, ...bounds } = pageFrame(width, height, this.layout, this.isPageFullScreen());
    this.tabs.setPageBounds(bounds);
    this.tabs.setPageRadius(radius);
    this.findBar.setArea(bounds);
    if (process.platform === 'darwin') {
      this.showWindowControls();
    }
  }
}

function pageAddress(url: string): string {
  return url.split('#')[0];
}
