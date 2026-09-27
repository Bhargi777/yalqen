import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BaseWindow, Menu, app, dialog, ipcMain, nativeTheme, session, shell } from 'electron';
import {
  BOOKMARKS_URL,
  HISTORY_URL,
  NEW_TAB_URL,
  IpcChannel,
  SettingsChannel,
  type ChromeLayout,
  type UiAction,
  type SettingsView,
} from '../shared/types.js';
import { AdBlocker } from './adblock.js';
import { BookmarkStore } from './bookmarks.js';
import { CertificateExceptions } from './certificates.js';
import { ChangeFeed } from './change-feed.js';
import { clearSince, sanitizeClearRequest } from './clear-data.js';
import { CommandBar } from './command-bar.js';
import { DEFAULT_DEVICE_ID, DEVICES } from './devices.js';
import { DownloadStore, uniquePath, type DownloadActions } from './downloads.js';
import { registerInternalScheme, serveInternalPages } from './internal-pages.js';
import { HistoryStore } from './history.js';
import { HttpsOnly, hostResolverOptions } from './https-only.js';
import { acceptLanguages, spellCheckerLanguages } from './page-preferences.js';
import { blockThirdPartyCookies } from './third-party-cookies.js';
import { FindBar } from './find-bar.js';
import { externalUrls } from './launch.js';
import { DISCARD_CHECK_MS } from './memory-saver.js';
import { buildMenu } from './menu.js';
import {
  PermissionStore,
  permissionOrigin,
  permissionQuestion,
  requestedPermissions,
  type SitePermission,
} from './permissions.js';
import { SessionStore, type SavedSession, type SavedTab } from './persistence.js';
import { SEARCH_ENGINES, isValidSearchTemplate, resolveSearchEngine } from './search.js';
import { SettingsStore } from './settings.js';
import { SettingsWindow } from './settings-window.js';
import { EMPTY_HISTORY_INDEX, suggest } from './suggestions.js';
import { recentPages } from './tabs.js';
import { YalqenWindow, type AppContext, type WindowOptions } from './window.js';
import { ZoomStore } from './zoom.js';

const DAILY_PARTITION = 'persist:daily';
const PRIVATE_PARTITION = 'private';
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);
const COMMAND_BAR_WARM_DELAY_MS = 2000;

app.setPath('userData', path.join(app.getPath('appData'), 'yalqen-electron-prototype'));

const appIcon = app.isPackaged
  ? path.join(process.resourcesPath, 'brand/icon-512.png')
  : path.resolve(app.getAppPath(), '../../design/brand/png/fitted/icon-512.png');

registerInternalScheme();
app.setName('Yalqen');

const primary = app.requestSingleInstanceLock();
const isFile = (file: string) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};
const pendingUrls: string[] = primary ? externalUrls(process.argv.slice(1), process.cwd(), isFile) : [];
let openExternal: ((urls: string[]) => void) | null = null;
const receiveUrls = (urls: string[]) => {
  if (urls.length === 0) return;
  if (openExternal) openExternal(urls);
  else pendingUrls.push(...urls);
};
app.on('open-url', (event, url) => {
  event.preventDefault();
  receiveUrls(externalUrls([url], process.cwd(), isFile));
});
app.on('open-file', (event, file) => {
  event.preventDefault();
  receiveUrls(externalUrls([file], process.cwd(), isFile));
});
app.on('second-instance', (_event, argv, workingDirectory) => {
  receiveUrls(externalUrls(argv.slice(1), workingDirectory, isFile));
});

function startBrowser(): void {
  const userData = app.getPath('userData');
  const daily = session.fromPartition(DAILY_PARTITION);
  const privateBrowsing = session.fromPartition(PRIVATE_PARTITION);
  const settings = new SettingsStore(userData);
  const history = new HistoryStore(userData);
  const downloads = new DownloadStore(userData);
  const bookmarks = new BookmarkStore(userData);
  const store = new SessionStore(userData);
  const defaultZoom = () => settings.get().defaultZoom;
  const zoom = new ZoomStore(userData, defaultZoom);
  const permissions = new PermissionStore(userData);
  const certificates = new CertificateExceptions();
  const httpsOnly = new HttpsOnly(() => settings.get().httpsOnly);
  app.configureHostResolver(hostResolverOptions(settings.get().secureDns));
  const closedTabs: SavedTab[] = [];
  let privatePermissions = new PermissionStore(null);
  let privateZoom = new ZoomStore(null, defaultZoom);
  const permissionsFor = (isPrivate: boolean) => (isPrivate ? privatePermissions : permissions);

  const windows: YalqenWindow[] = [];
  let current: YalqenWindow | null = null;
  let quitting = false;
  const eachWindow = (run: (window: YalqenWindow) => void) => {
    for (const window of [...windows]) run(window);
  };
  const pushState = () => eachWindow((window) => window.pushState());
  const reloadPages = (prefix: string) => eachWindow((window) => window.tabs.reloadPages(prefix));
  const windowOf = (contents: Electron.WebContents) =>
    windows.find((window) => window.tabs.hasContents(contents)) ?? current;
  const sessionSnapshot = (): SavedSession => ({
    version: 2,
    windows:
      settings.get().startupBehavior === 'restore'
        ? windows.filter((window) => !window.isPrivate).map((window) => window.tabs.toSavedWindow())
        : [],
  });

  let permissionPrompts: Promise<unknown> = Promise.resolve();
  const askPermission = (
    contents: Electron.WebContents,
    isPrivate: boolean,
    origin: string,
    kinds: SitePermission[],
  ): Promise<boolean> => {
    const answer = permissionPrompts.then(async () => {
      const store = permissionsFor(isPrivate);
      const decided = store.decide(origin, kinds);
      if (decided !== 'ask') return decided === 'allow';
      const parent = windowOf(contents)?.window;
      const options: Electron.MessageBoxOptions = {
        type: 'question',
        message: permissionQuestion(new URL(origin).host, kinds),
        detail: 'Bu kararı daha sonra adres çubuğundaki site bilgisinden değiştirebilirsiniz.',
        buttons: ['İzin ver', 'Bu seferlik izin ver', 'Engelle'],
        defaultId: 2,
        cancelId: 2,
        noLink: true,
      };
      const { response } = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
      if (response === 0) store.set(origin, kinds, 'allow');
      else if (response === 1) store.allowOnce(origin, kinds);
      else store.set(origin, kinds, 'deny');
      return response !== 2;
    });
    permissionPrompts = answer.catch(() => {});
    return answer;
  };
  const applyLanguages = () => {
    const language = settings.get().pageLanguage;
    for (const browsing of [daily, privateBrowsing]) {
      browsing.setUserAgent(browsing.getUserAgent(), acceptLanguages(language));
      if (process.platform !== 'darwin') browsing.setSpellCheckerLanguages(spellCheckerLanguages(language));
    }
  };
  applyLanguages();
  for (const browsing of [daily, privateBrowsing]) {
    blockThirdPartyCookies(browsing, () => settings.get().blockThirdPartyCookies);
  }
  for (const [browsing, isPrivate] of [[daily, false], [privateBrowsing, true]] as const) {
    browsing.setPermissionRequestHandler((contents, permission, callback, details) => {
      if (ALLOWED_PERMISSIONS.has(permission)) {
        callback(true);
        return;
      }
      const kinds = requestedPermissions(permission, 'mediaTypes' in details ? details.mediaTypes : []);
      const origin = permissionOrigin(details.requestingUrl);
      if (!kinds || !origin || origin !== permissionOrigin(contents.getURL())) {
        callback(false);
        return;
      }
      const decided = permissionsFor(isPrivate).decide(origin, kinds);
      if (decided !== 'ask') {
        callback(decided === 'allow');
        return;
      }
      askPermission(contents, isPrivate, origin, kinds).then(callback, () => callback(false));
    });
    browsing.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) => {
      if (ALLOWED_PERMISSIONS.has(permission)) return true;
      const kinds = requestedPermissions(permission, details.mediaType ? [details.mediaType] : []);
      const origin = permissionOrigin(requestingOrigin);
      if (!kinds || !origin) return false;
      if (details.embeddingOrigin && permissionOrigin(details.embeddingOrigin) !== origin) return false;
      return permissionsFor(isPrivate).decide(origin, kinds) === 'allow';
    });
  }

  const bookmarksChanged = () => {
    pushState();
    reloadPages(BOOKMARKS_URL);
  };
  const runBookmarksCommand = (command: string, params: URLSearchParams) => {
    const id = params.get('id') ?? '';
    const title = params.get('title') ?? '';
    switch (command) {
      case 'new-folder':
        bookmarks.addFolder(title);
        break;
      case 'rename':
        bookmarks.rename(id, title);
        break;
      case 'move':
        bookmarks.move(id, params.get('folder') || null);
        break;
      case 'remove':
        bookmarks.remove(id);
        break;
      case 'rename-folder':
        bookmarks.renameFolder(id, title);
        break;
      case 'remove-folder':
        bookmarks.removeFolder(id);
        break;
      default:
        return;
    }
    bookmarksChanged();
  };

  const downloadItems = new Map<string, Electron.DownloadItem>();
  const reservedPaths = new Set<string>();
  let downloadsStateTimer: NodeJS.Timeout | null = null;
  let downloadsPageTimer: NodeJS.Timeout | null = null;
  const downloadChanges = new ChangeFeed();
  const downloadsChanged = () => {
    downloadsStateTimer ??= setTimeout(() => {
      downloadsStateTimer = null;
      pushState();
    }, 250);
    downloadsPageTimer ??= setTimeout(() => {
      downloadsPageTimer = null;
      downloadChanges.notify();
    }, 500);
  };
  const withDownload = (id: string, run: (entry: NonNullable<ReturnType<DownloadStore['get']>>) => void) => {
    const entry = downloads.get(id);
    if (entry) run(entry);
    downloadsChanged();
  };
  const downloadActions = (window: YalqenWindow | null): DownloadActions => ({
    open: (id) =>
      withDownload(id, (entry) => {
        if (entry.state !== 'completed') return;
        void shell.openPath(entry.savePath).then((error) => {
          if (error) console.warn(`[downloads] could not open ${entry.filename}: ${error}`);
        });
      }),
    show: (id) => withDownload(id, (entry) => shell.showItemInFolder(entry.savePath)),
    pause: (id) =>
      withDownload(id, () => {
        downloadItems.get(id)?.pause();
        if (downloadItems.get(id)?.isPaused()) downloads.update(id, { state: 'paused' });
      }),
    resume: (id) =>
      withDownload(id, () => {
        const item = downloadItems.get(id);
        if (!item?.canResume()) return;
        item.resume();
        downloads.update(id, { state: 'progressing' });
      }),
    cancel: (id) => withDownload(id, () => downloadItems.get(id)?.cancel()),
    retry: (id) =>
      withDownload(id, (entry) => {
        if (entry.state !== 'cancelled' && entry.state !== 'interrupted') return;
        const item = downloadItems.get(id);
        if (item?.canResume()) {
          item.resume();
          return;
        }
        downloads.remove(id);
        (entry.private ? privateBrowsing : daily).downloadURL(entry.url);
      }),
    remove: (id) =>
      withDownload(id, (entry) => {
        if (entry.state !== 'progressing' && entry.state !== 'paused') downloads.remove(id);
      }),
    showAll: () => window?.tabs.openDownloads(),
    openFolder: () => {
      void shell.openPath(app.getPath('downloads')).then((error) => {
        if (error) console.warn(`[downloads] could not open folder: ${error}`);
      });
    },
  });
  const runDownloadsCommand = (command: string, params: URLSearchParams) => {
    if (command === 'clear') {
      downloads.clearFinished();
      downloadsChanged();
      return;
    }
    const actions = downloadActions(null);
    if (command in actions && command !== 'showAll' && command !== 'openFolder') {
      (actions[command as keyof DownloadActions] as (id: string) => void)(params.get('id') ?? '');
    }
  };
  const onWillDownload = (isPrivate: boolean) => (_event: Electron.Event, item: Electron.DownloadItem) => {
    const savePath = uniquePath(
      app.getPath('downloads'),
      item.getFilename(),
      (file) => reservedPaths.has(file) || fs.existsSync(file),
    );
    item.setSavePath(savePath);
    reservedPaths.add(savePath);
    const id = randomUUID();
    downloadItems.set(id, item);
    downloads.add({
      id,
      url: item.getURL(),
      filename: path.basename(savePath),
      savePath,
      state: 'progressing',
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      startedAt: Date.now(),
      ...(isPrivate ? { private: true } : {}),
    });
    item.on('updated', (_event, state) => {
      downloads.update(id, {
        state: state === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing',
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
      });
      downloadsChanged();
    });
    item.once('done', (_event, state) => {
      downloadItems.delete(id);
      reservedPaths.delete(savePath);
      downloads.update(id, {
        state: state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted',
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
      });
      downloadsChanged();
    });
    downloadsChanged();
  };
  daily.on('will-download', onWillDownload(false));
  privateBrowsing.on('will-download', onWillDownload(true));

  app.on('certificate-error', (event, contents, url, _error, certificate, callback, isMainFrame) => {
    const browsing = contents.session === daily || contents.session === privateBrowsing;
    if (browsing && certificates.allows(url, certificate.fingerprint)) {
      event.preventDefault();
      callback(true);
      return;
    }
    if (browsing && isMainFrame) certificates.reject(url, certificate.fingerprint);
    callback(false);
  });
  const adBlocker = new AdBlocker([daily, privateBrowsing], path.join(userData, 'adblock-engine.bin'));
  adBlocker.setEnabled(settings.get().adBlocking);
  const searchEngine = () => resolveSearchEngine(settings.get().searchEngine, settings.get().customSearchTemplate);
  const settingsWindow = new SettingsWindow({
    preload: path.join(__dirname, '../preload/settings-preload.js'),
    page: path.join(__dirname, '../renderer/settings.html'),
    icon: appIcon,
  });
  const commandBar = new CommandBar({
    preload: path.join(__dirname, '../preload/command-preload.js'),
    page: path.join(__dirname, '../renderer/command.html'),
  });
  const findBar = new FindBar({
    preload: path.join(__dirname, '../preload/find-preload.js'),
    page: path.join(__dirname, '../renderer/find.html'),
  });
  nativeTheme.themeSource = settings.get().theme;
  let deviceId = DEFAULT_DEVICE_ID;

  const clientPath = app.isPackaged ? undefined : process.execPath;
  const clientArgs = app.isPackaged ? undefined : [path.resolve(process.argv[1] ?? '.')];
  const settingsView = (): SettingsView => {
    const { version: _version, ...values } = settings.get();
    return {
      values,
      defaultBrowser: app.isDefaultProtocolClient('https', clientPath, clientArgs),
      engines: SEARCH_ENGINES.map(({ id, label }) => ({ id, label })),
      customTemplateValid: isValidSearchTemplate(values.customSearchTemplate),
    };
  };
  const updateSettings = (patch: unknown) => {
    const wasFreezing = settings.get().freezeBackgroundTabs;
    const previousDns = settings.get().secureDns;
    const previousZoom = settings.get().defaultZoom;
    const previousLanguage = settings.get().pageLanguage;
    settings.update(patch);
    if (settings.get().defaultZoom !== previousZoom) eachWindow((window) => window.tabs.applyDefaultZoom());
    if (settings.get().pageLanguage !== previousLanguage) applyLanguages();
    if (settings.get().secureDns !== previousDns) app.configureHostResolver(hostResolverOptions(settings.get().secureDns));
    nativeTheme.themeSource = settings.get().theme;
    if (settings.get().freezeBackgroundTabs !== wasFreezing) eachWindow((window) => window.tabs.applyFreezeSetting());
    adBlocker.setEnabled(settings.get().adBlocking);
    pushState();
    settingsWindow.send(settingsView());
  };

  const context: AppContext = {
    icon: appIcon,
    daily,
    privateBrowsing,
    settings,
    settingsWindow,
    commandBar,
    findBar,
    history,
    downloads,
    bookmarks,
    certificates,
    httpsOnly,
    closedTabs,
    permissionsFor,
    zoomFor: (isPrivate) => (isPrivate ? privateZoom : zoom),
    searchEngine,
    downloadActions: (window) => downloadActions(window),
    downloadsChanged,
    toggleBookmark: (url, title) => {
      const existing = bookmarks.find(url);
      if (existing) bookmarks.remove(existing.id);
      else bookmarks.add(url, title);
      bookmarksChanged();
    },
    runBookmarksCommand,
    runDownloadsCommand,
    updateSettings,
    deviceId: () => deviceId,
    openWindow: (options) => openWindow(options),
    onWindowChange: (persist) => {
      if (persist && !quitting) store.scheduleSave(sessionSnapshot);
    },
    onPrivateTabsClosed: () => {
      if (windows.some((window) => window.tabs.hasPrivateTabs)) return;
      privatePermissions = new PermissionStore(null);
      privateZoom = new ZoomStore(null, defaultZoom);
      downloads.removePrivate();
      downloadsChanged();
      void privateBrowsing.clearStorageData();
      void privateBrowsing.clearCache();
      void privateBrowsing.clearAuthCache();
      void privateBrowsing.closeAllConnections();
    },
    onWindowFocus: (window) => {
      current = window;
    },
    onWindowClosing: (window) => {
      if (quitting) return;
      if (windows.length === 1) {
        quitting = true;
        store.saveNow(sessionSnapshot());
        return;
      }
      const index = windows.indexOf(window);
      if (index >= 0) windows.splice(index, 1);
      store.scheduleSave(sessionSnapshot);
    },
    onWindowClosed: (window) => {
      const index = windows.indexOf(window);
      if (index >= 0) windows.splice(index, 1);
      if (current === window) current = windows.at(-1) ?? null;
    },
  };

  const openWindow = (options: WindowOptions): YalqenWindow => {
    const window = new YalqenWindow(context, options);
    windows.push(window);
    current = window;
    return window;
  };

  for (const browsing of [daily, privateBrowsing]) {
    serveInternalPages(
      browsing,
      path.join(__dirname, '../renderer/newtab.html'),
      path.join(__dirname, '../renderer/newtab-suggestions.js'),
      path.join(__dirname, '../renderer/history.html'),
      path.join(__dirname, '../renderer/downloads.html'),
      path.join(__dirname, '../renderer/bookmarks.html'),
      () => recentPages(closedTabs),
      () => [...new Map(windows.flatMap((window) => window.tabs.pinnedPages).map((page) => [page.url, page])).values()],
      (query) => history.list(query),
      { list: () => downloads.list(), changes: downloadChanges },
      (query) => ({ folders: bookmarks.folders(), bookmarks: bookmarks.bookmarks(query) }),
      () => {
        const showWelcome = !settings.get().welcomeCompleted;
        if (showWelcome) settings.update({ welcomeCompleted: true });
        return showWelcome;
      },
      (query) => suggest(query, {
        tabs: [],
        bookmarks: bookmarks.bookmarks(),
        history: browsing === privateBrowsing ? EMPTY_HISTORY_INDEX : history.index(),
      }),
    );
  }

  const inWindow = (run: (window: YalqenWindow) => void) => () => {
    run(current && !current.window.isDestroyed() ? current : openWindow({}));
  };
  Menu.setApplicationMenu(
    buildMenu({
      newTab: inWindow((window) => window.tabs.open()),
      newWindow: () => openWindow({ from: current ?? undefined }),
      newPrivateWindow: () => openWindow({ isPrivate: true, from: current ?? undefined }),
      newPrivateTab: inWindow((window) => window.tabs.open(NEW_TAB_URL, { isPrivate: true })),
      closeTab: () => {
        if (settingsWindow.isFocused()) settingsWindow.close();
        else if (current?.tabs.activeTabId) current.tabs.close(current.tabs.activeTabId);
      },
      closeWindow: () => {
        if (settingsWindow.isFocused()) settingsWindow.close();
        else BaseWindow.getFocusedWindow()?.close();
      },
      reopenClosedTab: inWindow((window) => window.tabs.reopenClosed()),
      moveTabToNewWindow: inWindow((window) => window.moveActiveTabToNewWindow()),
      selectNextTab: inWindow((window) => window.tabs.selectRelative(1)),
      selectPreviousTab: inWindow((window) => window.tabs.selectRelative(-1)),
      selectTab: (index) => current?.tabs.selectByIndex(index),
      focusAddress: inWindow((window) => window.openAddress()),
      find: () => {
        if (!settingsWindow.isFocused()) current?.openFind();
      },
      findNext: (forward) => {
        if (!settingsWindow.isFocused()) current?.openFind(forward);
      },
      reload: () => current?.tabs.reload(),
      zoom: (direction) => current?.tabs.zoom(direction),
      togglePanel: () => updateSettings({ panelCollapsed: !settings.get().panelCollapsed }),
      toggleSidebar: () => updateSettings({ sidebarVisible: !settings.get().sidebarVisible }),
      toggleToolbar: () => updateSettings({ toolbarVisible: !settings.get().toolbarVisible }),
      toggleDevTools: () => current?.tabs.toggleDevTools(),
      toggleDeviceView: () => current?.tabs.toggleEmulation(deviceId),
      rotateDevice: () => current?.tabs.rotateDevice(),
      devices: DEVICES.map((device) => ({
        id: device.id,
        label: device.label,
        checked: device.id === deviceId,
      })),
      selectDevice: (id) => {
        deviceId = id;
        current?.tabs.selectDevice(id);
      },
      openSettings: () => settingsWindow.open(),
      toggleBookmark: () => {
        const page = current?.tabs.activePage();
        if (page) context.toggleBookmark(page.url, page.title);
      },
      showBookmarks: inWindow((window) => window.tabs.openBookmarks()),
      print: () => current?.print(),
      savePdf: () => void current?.savePageAsPdf(),
      viewSource: () => current?.tabs.viewSource(),
    }),
  );

  const senderWindow = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) =>
    windows.find((window) => window.uiContents === event.sender);
  ipcMain.handle(IpcChannel.getState, (event) => senderWindow(event)?.state() ?? null);
  ipcMain.on(IpcChannel.setLayout, (event, next: ChromeLayout) => senderWindow(event)?.setLayout(next));
  ipcMain.on(IpcChannel.action, (event, action: UiAction) => senderWindow(event)?.handleAction(action));
  ipcMain.handle(SettingsChannel.get, (event) => (event.sender === settingsWindow.contents ? settingsView() : null));
  ipcMain.handle(SettingsChannel.clearData, async (event, value: unknown) => {
    if (event.sender !== settingsWindow.contents) return;
    const request = sanitizeClearRequest(value);
    if (!request) return;
    const since = clearSince(request.range, Date.now());
    if (request.history) {
      history.clearSince(since);
      closedTabs.length = 0;
      reloadPages(HISTORY_URL);
      reloadPages(NEW_TAB_URL);
    }
    if (request.downloads) {
      downloads.removeSince(since);
      downloadsChanged();
    }
    if (request.siteData) await daily.clearStorageData();
    if (request.cache) await daily.clearCache();
  });
  ipcMain.handle(SettingsChannel.makeDefault, (event) => {
    if (event.sender !== settingsWindow.contents) return null;
    for (const scheme of ['http', 'https']) {
      if (!app.setAsDefaultProtocolClient(scheme, clientPath, clientArgs)) {
        console.warn(`[default-browser] the system did not accept ${scheme}`);
      }
    }
    return settingsView();
  });
  ipcMain.handle(SettingsChannel.update, (event, patch: unknown) => {
    if (event.sender !== settingsWindow.contents) return null;
    updateSettings(patch);
    return settingsView();
  });

  const discardTimer = setInterval(() => {
    const minutes = settings.get().discardAfterMinutes;
    if (minutes > 0) eachWindow((window) => window.tabs.discardInactive(Date.now(), minutes));
  }, DISCARD_CHECK_MS);

  app.on('before-quit', () => {
    if (quitting) return;
    quitting = true;
    store.saveNow(sessionSnapshot());
  });
  app.on('will-quit', () => {
    clearInterval(discardTimer);
    adBlocker.destroy();
    commandBar.destroy();
    findBar.destroy();
    settingsWindow.close();
    history.saveNow();
    downloads.saveNow();
    bookmarks.saveNow();
    zoom.saveNow();
    permissions.saveNow();
  });
  app.on('activate', () => {
    if (windows.length === 0 && !quitting) openWindow({});
  });

  const saved = settings.get().startupBehavior === 'restore' ? store.load() : null;
  const restored = saved?.windows.filter((window) => window.tabs.length > 0) ?? [];
  const [first, ...rest] = pendingUrls.splice(0);
  if (restored.length === 0) openWindow(first ? { url: first } : {});
  for (const window of restored) openWindow({ saved: window });
  openExternal = (urls) => {
    const window = current && !current.window.isDestroyed() ? current : openWindow({ url: urls.shift() });
    for (const url of urls) window.tabs.open(url);
    window.focus();
  };
  if (restored.length > 0 && first) openExternal([first, ...rest]);
  else if (rest.length > 0) openExternal(rest);
  setTimeout(() => commandBar.warm(), COMMAND_BAR_WARM_DELAY_MS);
}

app.setAboutPanelOptions({
  applicationName: 'Yalqen',
  applicationVersion: app.getVersion(),
  version: `Faz 0 prototipi · Electron ${process.versions.electron}`,
  iconPath: appIcon,
});

if (!primary) {
  app.quit();
} else {
  app.whenReady().then(() => {
    app.dock?.setIcon(appIcon);
    startBrowser();
  });
}
app.on('window-all-closed', () => app.quit());
