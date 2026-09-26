import path from 'node:path';
import { BaseWindow, Menu, WebContentsView, app, clipboard, ipcMain, nativeTheme, screen, session, shell } from 'electron';
import {
  NEW_TAB_URL,
  IpcChannel,
  SettingsChannel,
  type BrowserState,
  type ChromeLayout,
  type UiAction,
  type UiCommand,
  type SettingsView,
  type WindowMaterial,
} from '../shared/types.js';
import { AdBlocker } from './adblock.js';
import { CommandBar } from './command-bar.js';
import { contextMenuTemplate } from './context-menu.js';
import { DEFAULT_DEVICE_ID, DEVICES } from './devices.js';
import { FindBar } from './find-bar.js';
import { registerInternalScheme, serveInternalPages } from './internal-pages.js';
import { applyGlass, glassAvailable } from './glass.js';
import { HistoryStore } from './history.js';
import { buildMenu } from './menu.js';
import { pageFrame } from './page-layout.js';
import { SessionStore } from './persistence.js';
import { Preconnector } from './preconnect.js';
import { SEARCH_ENGINES, buildSearchUrl, isValidSearchTemplate, resolveSearchEngine } from './search.js';
import { SettingsStore } from './settings.js';
import { SettingsWindow } from './settings-window.js';
import { TabManager } from './tabs.js';
import { ZoomStore } from './zoom.js';
import { resolveInput } from './url.js';

const DAILY_PARTITION = 'persist:daily';
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);
// Offset of the traffic lights from the top-left corner. Their 14pt buttons then
// share the 22px center line of the back and forward capsule.
const WINDOW_CONTROLS_INSET = { x: 16, y: 15 };
// Corner that keeps hover-revealed traffic lights visible, and how often it is checked.
const WINDOW_CONTROLS_ZONE = { minWidth: 76, maxWidth: 240, height: 44 };
// Lets the UI move its buttons out of the way before the controls appear.
const WINDOW_CONTROLS_DELAY_MS = 120;
const WINDOW_CONTROLS_POLL_MS = 150;

// Keep prototype data apart from any other Electron app.
app.setPath('userData', path.join(app.getPath('appData'), 'yalqen-electron-prototype'));

const appIcon = app.isPackaged
  ? path.join(process.resourcesPath, 'brand/icon-512.png')
  : path.resolve(app.getAppPath(), '../../design/brand/png/fitted/icon-512.png');

registerInternalScheme();
app.setName('Yalqen');

function createBrowser(): void {
  const window = new BaseWindow({
    width: 1280,
    height: 820,
    minWidth: 640,
    minHeight: 400,
    title: 'Yalqen',
    icon: appIcon,
    titleBarStyle: 'hiddenInset',
    // The glass view sits behind the UI, so the window itself must be see-through.
    transparent: glassAvailable,
  });

  const ui = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (glassAvailable) ui.setBackgroundColor('#00000000');
  ui.webContents.on('will-navigate', (event) => event.preventDefault());
  ui.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.contentView.addChildView(ui);

  const daily = session.fromPartition(DAILY_PARTITION);
  daily.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(ALLOWED_PERMISSIONS.has(permission)),
  );
  daily.setPermissionCheckHandler((_contents, permission) => ALLOWED_PERMISSIONS.has(permission));
  const history = new HistoryStore(app.getPath('userData'));
  const store = new SessionStore(app.getPath('userData'));
  const settings = new SettingsStore(app.getPath('userData'));
  const zoom = new ZoomStore(app.getPath('userData'));
  const adBlocker = new AdBlocker(daily, path.join(app.getPath('userData'), 'adblock-engine.bin'));
  adBlocker.setEnabled(settings.get().adBlocking);
  const searchEngine = () =>
    resolveSearchEngine(settings.get().searchEngine, settings.get().customSearchTemplate);
  const preconnector = new Preconnector((origin) => daily.preconnect({ url: origin }));
  const settingsWindow = new SettingsWindow({
    preload: path.join(__dirname, '../preload/settings-preload.js'),
    page: path.join(__dirname, '../renderer/settings.html'),
    icon: appIcon,
  });
  nativeTheme.themeSource = settings.get().theme;
  let layout: ChromeLayout = {
    panelWidth: 220,
    panelSide: 'left',
    windowControls: true,
    chromeHeight: 44,
    pageInset: 8,
    pageRadius: 16,
  };
  // Device used by the phone view shortcut; the last one picked from the menu.
  // Radio items keep their own checked state, so the menu is not rebuilt.
  let deviceId = DEFAULT_DEVICE_ID;
  // Optimistic until the glass view is added, so the UI does not start opaque.
  let glassApplied = glassAvailable;
  let htmlFullScreenTabId: string | null = null;
  const isPageFullScreen = () => htmlFullScreenTabId !== null && htmlFullScreenTabId === tabs.activeTabId;

  const material = (): WindowMaterial =>
    glassApplied && !nativeTheme.prefersReducedTransparency ? 'glass' : 'opaque';

  const browserState = (): BrowserState => ({
    ...tabs.state(),
    pageFullScreen: isPageFullScreen(),
    addressPlaceholder: searchEngine().placeholder,
    panelCollapsed: settings.get().panelCollapsed,
    panelSide: settings.get().panelSide,
    material: material(),
  });
  const pushState = () => {
    if (!ui.webContents.isDestroyed()) {
      ui.webContents.send(IpcChannel.state, browserState());
    }
  };
  const notifyUi = (command: UiCommand) => {
    if (!ui.webContents.isDestroyed()) ui.webContents.send(IpcChannel.command, command);
  };

  const commandBar = new CommandBar({
    window,
    preload: path.join(__dirname, '../preload/command-preload.js'),
    page: path.join(__dirname, '../renderer/command.html'),
    onSubmit: (input, mode) => {
      preconnector.cancel();
      const url = resolveInput(input, searchEngine());
      if (mode === 'new-tab') tabs.open(url);
      else tabs.navigate(url);
    },
    onDismiss: () => {
      preconnector.cancel();
      if (!tabs.focusActive()) ui.webContents.focus();
    },
    onInput: (input) => preconnector.typed(input, searchEngine()),
  });

  // Tab and address (without fragment) the find bar searches; it closes when either changes.
  let findTarget: { tabId: string; url: string } | null = null;
  const pageAddress = (url: string) => url.split('#')[0];
  const endFind = () => {
    if (findTarget) tabs.stopFind(findTarget.tabId);
    findTarget = null;
    findBar.close();
  };
  /** Opens the find bar, or moves to the next or previous match when `forward` is set. */
  const openFind = (forward?: boolean) => {
    if (settingsWindow.isFocused() || isPageFullScreen() || !tabs.activeTabId) return;
    commandBar.close();
    findTarget = { tabId: tabs.activeTabId, url: pageAddress(tabs.activeUrl) };
    if (forward === undefined) findBar.open();
    else findBar.findNext(forward);
  };
  const findBar = new FindBar({
    window,
    preload: path.join(__dirname, '../preload/find-preload.js'),
    page: path.join(__dirname, '../renderer/find.html'),
    onFind: (text, forward, next) => tabs.findInPage(text, forward, next),
    onClose: () => {
      if (findTarget) tabs.stopFind(findTarget.tabId);
      findTarget = null;
      if (!tabs.focusActive()) ui.webContents.focus();
    },
  });

  const tabs: TabManager = new TabManager({
    window,
    session: daily,
    freezeBackground: () => settings.get().freezeBackgroundTabs,
    onChange: (persist) => {
      if (htmlFullScreenTabId && htmlFullScreenTabId !== tabs.activeTabId) {
        htmlFullScreenTabId = null;
        syncPageFullScreen();
      }
      if (findTarget && (findTarget.tabId !== tabs.activeTabId || findTarget.url !== pageAddress(tabs.activeUrl))) {
        endFind();
      }
      findBar.keepOnTop();
      commandBar.keepOnTop();
      pushState();
      if (persist) store.scheduleSave(() => tabs.toSession());
    },
    onNewTabSearch: (query) => {
      if (query.trim() === '') openCenteredAddress();
      else tabs.navigate(resolveInput(query, searchEngine()));
    },
    onHtmlFullScreenChange: (tabId, fullScreen) => {
      if (fullScreen) {
        if (tabId !== tabs.activeTabId || htmlFullScreenTabId === tabId) return;
        htmlFullScreenTabId = tabId;
      } else {
        if (htmlFullScreenTabId !== tabId) return;
        htmlFullScreenTabId = null;
      }
      syncPageFullScreen();
    },
    onVisit: (url, title) => history.visit(url, title),
    onVisitTitle: (id, title) => history.setTitle(id, title),
    onHistoryDelete: (id) => history.remove(id),
    onHistoryClear: () => history.clear(),
    onFindResult: (result) => findBar.showResult(result),
    zoomFor: (url) => zoom.get(url),
    onZoom: (url, factor) => zoom.set(url, factor),
    onContextMenu: (contents, params) => {
      const history = contents.navigationHistory;
      const template = contextMenuTemplate(params, {
        canGoBack: history.canGoBack(),
        canGoForward: history.canGoForward(),
        // Like other browsers, links open next to the page without leaving it.
        openInNewTab: (url) => tabs.open(url, { activate: false }),
        copyText: (text) => clipboard.writeText(text),
        copyImage: () => contents.copyImageAt(params.x, params.y),
        search: (text) => tabs.open(buildSearchUrl(searchEngine(), text)),
        goBack: () => history.goBack(),
        goForward: () => history.goForward(),
        reload: () => contents.reload(),
        inspect: () => contents.inspectElement(params.x, params.y),
      });
      Menu.buildFromTemplate(template).popup({ window });
    },
  });

  serveInternalPages(
    daily,
    path.join(__dirname, '../renderer/newtab.html'),
    path.join(__dirname, '../renderer/history.html'),
    () => tabs.recentlyClosed(),
    (query) => history.list(query),
    () => {
      const showWelcome = !settings.get().welcomeCompleted;
      if (showWelcome) settings.update({ welcomeCompleted: true });
      return showWelcome;
    },
  );

  // Showing the traffic lights again puts them back in their default place, so the
  // position is set each time they appear. In full screen macOS shows them in the
  // title bar that slides down from the top edge, so they stay on and in place there.
  const setWindowControls = (visible: boolean) => {
    const fullScreen = window.isFullScreen();
    window.setWindowButtonVisibility(visible || fullScreen);
    if (visible && !fullScreen) window.setWindowButtonPosition(WINDOW_CONTROLS_INSET);
  };
  const applyLayout = () => {
    const { width, height } = window.getContentBounds();
    ui.setBounds({ x: 0, y: 0, width, height });
    commandBar.fitWindow();
    const { radius, ...bounds } = pageFrame(width, height, layout, isPageFullScreen());
    tabs.setPageBounds(bounds);
    tabs.setPageRadius(radius);
    findBar.setArea(bounds);
    if (process.platform === 'darwin') {
      setWindowControls(layout.windowControls || controlsRevealed);
    }
  };
  // Hidden traffic lights appear while the pointer is over their corner. The
  // UI reports entering it; leaving is polled, since the pointer over the native
  // buttons is not seen by the page.
  let controlsRevealed = false;
  let controlsTimer: NodeJS.Timeout | null = null;
  let controlsDelay: NodeJS.Timeout | null = null;
  const revealWindowControls = (zoneWidth: number) => {
    if (process.platform !== 'darwin' || controlsRevealed || window.isFullScreen()) return;
    const width = Math.min(
      WINDOW_CONTROLS_ZONE.maxWidth,
      Math.max(WINDOW_CONTROLS_ZONE.minWidth, Number(zoneWidth) || 0),
    );
    controlsRevealed = true;
    notifyUi({ type: 'window-controls', visible: true });
    controlsDelay = setTimeout(() => setWindowControls(true), WINDOW_CONTROLS_DELAY_MS);
    controlsTimer = setInterval(() => {
      const cursor = screen.getCursorScreenPoint();
      const bounds = window.getContentBounds();
      const inside =
        cursor.x >= bounds.x &&
        cursor.x < bounds.x + width &&
        cursor.y >= bounds.y &&
        cursor.y < bounds.y + WINDOW_CONTROLS_ZONE.height;
      if (inside) return;
      hideWindowControls();
      setWindowControls(layout.windowControls);
      notifyUi({ type: 'window-controls', visible: false });
    }, WINDOW_CONTROLS_POLL_MS);
  };
  const hideWindowControls = () => {
    if (controlsTimer) clearInterval(controlsTimer);
    if (controlsDelay) clearTimeout(controlsDelay);
    controlsTimer = null;
    controlsDelay = null;
    controlsRevealed = false;
  };

  const syncPageFullScreen = () => {
    if (isPageFullScreen()) {
      commandBar.close();
      endFind();
      hideWindowControls();
    }
    applyLayout();
    pushState();
  };

  window.on('resize', applyLayout);
  window.on('enter-full-screen', () => {
    // A reveal in progress is dropped: the title bar takes over.
    if (controlsRevealed) {
      hideWindowControls();
      notifyUi({ type: 'window-controls', visible: false });
    }
    applyLayout();
  });
  window.on('leave-full-screen', applyLayout);
  applyLayout();

  const settingsView = (): SettingsView => {
    const { version: _version, ...values } = settings.get();
    return {
      values,
      engines: SEARCH_ENGINES.map(({ id, label }) => ({ id, label })),
      customTemplateValid: isValidSearchTemplate(values.customSearchTemplate),
    };
  };
  const updateSettings = (patch: unknown) => {
    const wasFreezing = settings.get().freezeBackgroundTabs;
    settings.update(patch);
    nativeTheme.themeSource = settings.get().theme;
    if (settings.get().freezeBackgroundTabs !== wasFreezing) tabs.applyFreezeSetting();
    adBlocker.setEnabled(settings.get().adBlocking);
    pushState();
    settingsWindow.send(settingsView());
  };
  const togglePanel = () => updateSettings({ panelCollapsed: !settings.get().panelCollapsed });

  const openCenteredAddress = () => {
    const url = tabs.activeUrl;
    if (url === NEW_TAB_URL && tabs.focusNewTabSearch()) return;
    preconnector.opened(searchEngine());
    commandBar.open({
      placeholder: searchEngine().placeholder,
      mode: 'navigate',
      value: url === NEW_TAB_URL || url === 'about:blank' ? '' : url,
    });
  };

  Menu.setApplicationMenu(
    buildMenu({
      newTab: () => tabs.open(),
      closeTab: () => {
        // The shortcut is app-wide; in the settings window it closes that window.
        if (settingsWindow.isFocused()) settingsWindow.close();
        else if (tabs.activeTabId) tabs.close(tabs.activeTabId);
      },
      reopenClosedTab: () => tabs.reopenClosed(),
      selectNextTab: () => tabs.selectRelative(1),
      selectPreviousTab: () => tabs.selectRelative(-1),
      selectTab: (index) => tabs.selectByIndex(index),
      focusAddress: openCenteredAddress,
      find: () => openFind(),
      findNext: (forward) => openFind(forward),
      reload: () => tabs.reload(),
      zoom: (direction) => tabs.zoom(direction),
      togglePanel,
      toggleDevTools: () => tabs.toggleDevTools(),
      toggleDeviceView: () => tabs.toggleEmulation(deviceId),
      rotateDevice: () => tabs.rotateDevice(),
      devices: DEVICES.map((device) => ({
        id: device.id,
        label: device.label,
        checked: device.id === deviceId,
      })),
      selectDevice: (id) => {
        deviceId = id;
        tabs.selectDevice(id);
      },
      openSettings: () => settingsWindow.open(),
    }),
  );

  ipcMain.handle(IpcChannel.getState, (event) =>
    event.sender === ui.webContents ? browserState() : null,
  );
  ipcMain.on(IpcChannel.setLayout, (event, next: ChromeLayout) => {
    if (event.sender !== ui.webContents) return;
    layout = next;
    applyLayout();
  });
  ipcMain.on(IpcChannel.action, (event, action: UiAction) => {
    if (event.sender !== ui.webContents) return;
    handleAction(action);
  });
  ipcMain.handle(SettingsChannel.get, (event) =>
    event.sender === settingsWindow.contents ? settingsView() : null,
  );
  ipcMain.handle(SettingsChannel.update, (event, patch: unknown) => {
    if (event.sender !== settingsWindow.contents) return null;
    updateSettings(patch);
    return settingsView();
  });

  function handleAction(action: UiAction): void {
    switch (action.type) {
      case 'new-tab':
        if (action.url) tabs.open(action.url);
        else tabs.open();
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
      case 'move-tab':
        tabs.move(action.id, action.toIndex);
        break;
      case 'navigate':
        tabs.navigate(resolveInput(action.input, searchEngine()));
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
      case 'toggle-panel':
        togglePanel();
        break;
      case 'open-address':
        openCenteredAddress();
        break;
      case 'open-profile-menu':
        Menu.buildFromTemplate([
          { label: 'Yalqen profili', enabled: false },
          { type: 'separator' },
          { label: 'Ayarlar…', click: () => settingsWindow.open() },
        ]).popup({ window });
        break;
      case 'open-downloads':
        void shell.openPath(app.getPath('downloads')).then((error) => {
          if (error) console.warn(`[downloads] could not open folder: ${error}`);
        });
        break;
      case 'open-history':
        tabs.openHistory();
        break;
      case 'reveal-window-controls':
        revealWindowControls(action.width);
        break;
      case 'open-settings':
        settingsWindow.open();
        break;
    }
  }

  // "Reduce transparency" can change while the app runs; the UI then paints opaque.
  nativeTheme.on('updated', pushState);
  ui.webContents.once('did-finish-load', () => {
    glassApplied = applyGlass(window);
    pushState();
  });

  window.on('close', () => {
    hideWindowControls();
    adBlocker.destroy();
    settingsWindow.close();
    nativeTheme.off('updated', pushState);
    store.saveNow(
      settings.get().startupBehavior === 'restore'
        ? tabs.toSession()
        : { version: 1, activeTabId: null, tabs: [] },
    );
    history.saveNow();
    tabs.destroyAll();
    commandBar.destroy();
    findBar.destroy();
    if (!ui.webContents.isDestroyed()) ui.webContents.close();
  });

  const saved = store.load();
  if (settings.get().startupBehavior === 'restore' && saved && saved.tabs.length > 0) {
    tabs.restore(saved);
  } else {
    tabs.open();
  }

  void ui.webContents.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.setAboutPanelOptions({
  applicationName: 'Yalqen',
  applicationVersion: app.getVersion(),
  version: `Faz 0 prototipi · Electron ${process.versions.electron}`,
  iconPath: appIcon,
});

app.whenReady().then(() => {
  // The unpackaged macOS run needs its Dock icon set separately from the bundle icon.
  app.dock?.setIcon(appIcon);
  createBrowser();
});
app.on('window-all-closed', () => app.quit());
