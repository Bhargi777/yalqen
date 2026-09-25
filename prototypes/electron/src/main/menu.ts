import { Menu, type MenuItemConstructorOptions } from 'electron';

export interface MenuActions {
  newTab(): void;
  closeTab(): void;
  reopenClosedTab(): void;
  focusAddress(): void;
  reload(): void;
  goBack(): void;
  goForward(): void;
  togglePanel(): void;
  toggleDevTools(): void;
  selectTab(index: number): void;
  openPageSet(): void;
  discardBackground(): void;
  recordSnapshot(): void;
}

/** Shortcuts live in the app menu so they work while a page has focus. */
export function buildMenu(actions: MenuActions): Menu {
  const tabShortcuts: MenuItemConstructorOptions[] = Array.from({ length: 9 }, (_, i) => ({
    label: i === 8 ? 'Son sekme' : `Sekme ${i + 1}`,
    accelerator: `CmdOrCtrl+${i + 1}`,
    click: () => actions.selectTab(i === 8 ? -1 : i),
  }));

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Dosya',
      submenu: [
        { label: 'Yeni sekme', accelerator: 'CmdOrCtrl+T', click: actions.newTab },
        { label: 'Sekmeyi kapat', accelerator: 'CmdOrCtrl+W', click: actions.closeTab },
        {
          label: 'Kapatılan sekmeyi aç',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: actions.reopenClosedTab,
        },
        { type: 'separator' },
        { label: 'Adres çubuğu', accelerator: 'CmdOrCtrl+L', click: actions.focusAddress },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Yenile', accelerator: 'CmdOrCtrl+R', click: actions.reload },
        { label: 'Sekme panelini daralt/genişlet', accelerator: 'CmdOrCtrl+S', click: actions.togglePanel },
        { type: 'separator' },
        { label: 'Sayfa DevTools', accelerator: 'Alt+CmdOrCtrl+I', click: actions.toggleDevTools },
      ],
    },
    {
      label: 'Geçmiş',
      submenu: [
        { label: 'Geri', accelerator: 'CmdOrCtrl+[', click: actions.goBack },
        { label: 'İleri', accelerator: 'CmdOrCtrl+]', click: actions.goForward },
      ],
    },
    { label: 'Sekmeler', submenu: tabShortcuts },
    {
      label: 'Ölçüm',
      submenu: [
        { label: 'Sayfa setini aç', click: actions.openPageSet },
        { label: 'Arka plan sekmelerini bellekten çıkar', click: actions.discardBackground },
        { label: 'Bellek ölçümü kaydet', accelerator: 'CmdOrCtrl+Shift+M', click: actions.recordSnapshot },
      ],
    },
    { role: 'windowMenu' },
  ];

  return Menu.buildFromTemplate(template);
}
