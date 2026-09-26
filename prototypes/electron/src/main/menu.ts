import { Menu, type MenuItemConstructorOptions } from 'electron';
import type { DeviceId } from '../shared/types.js';

export interface DeviceMenuItem {
  id: DeviceId;
  label: string;
  checked: boolean;
}

export interface MenuActions {
  newTab(): void;
  newWindow(): void;
  newPrivateWindow(): void;
  newPrivateTab(): void;
  closeTab(): void;
  closeWindow(): void;
  moveTabToNewWindow(): void;
  reopenClosedTab(): void;
  selectNextTab(): void;
  selectPreviousTab(): void;
  /** Selects the tab at `index`; -1 selects the last tab. */
  selectTab(index: number): void;
  focusAddress(): void;
  find(): void;
  findNext(forward: boolean): void;
  reload(): void;
  zoom(direction: 1 | -1 | 0): void;
  togglePanel(): void;
  toggleDevTools(): void;
  toggleDeviceView(): void;
  rotateDevice(): void;
  devices: DeviceMenuItem[];
  selectDevice(id: DeviceId): void;
  openSettings(): void;
  toggleBookmark(): void;
  showBookmarks(): void;
  print(): void;
  savePdf(): void;
  viewSource(): void;
}

/** Shortcuts live in the app menu so they work while a page has focus. */
export function buildMenu(actions: MenuActions): Menu {
  const isMac = process.platform === 'darwin';
  const settingsItem: MenuItemConstructorOptions = {
    label: 'Ayarlar…',
    accelerator: 'CmdOrCtrl+,',
    click: actions.openSettings,
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Yalqen',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settingsItem,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'Dosya',
      submenu: [
        { label: 'Yeni sekme', accelerator: 'CmdOrCtrl+T', click: actions.newTab },
        { label: 'Yeni pencere', accelerator: 'CmdOrCtrl+N', click: actions.newWindow },
        { label: 'Yeni gizli pencere', accelerator: 'CmdOrCtrl+Shift+N', click: actions.newPrivateWindow },
        { label: 'Yeni gizli sekme', click: actions.newPrivateTab },
        { type: 'separator' },
        { label: 'Sekmeyi kapat', accelerator: 'CmdOrCtrl+W', click: actions.closeTab },
        { label: 'Pencereyi kapat', accelerator: 'CmdOrCtrl+Shift+W', click: actions.closeWindow },
        {
          label: 'Kapatılan sekmeyi aç',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: actions.reopenClosedTab,
        },
        { type: 'separator' },
        { label: 'Adres çubuğu', accelerator: 'CmdOrCtrl+L', click: actions.focusAddress },
        { type: 'separator' },
        { label: 'PDF olarak kaydet…', accelerator: 'CmdOrCtrl+Shift+S', click: actions.savePdf },
        { label: 'Yazdır…', accelerator: 'CmdOrCtrl+P', click: actions.print },
        ...(isMac ? [] : [{ type: 'separator' } as const, settingsItem]),
      ],
    },
    {
      label: 'Düzen',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [{ role: 'pasteAndMatchStyle' } as const] : []),
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Bul…', accelerator: 'CmdOrCtrl+F', click: actions.find },
        { label: 'Sonrakini bul', accelerator: 'CmdOrCtrl+G', click: () => actions.findNext(true) },
        { label: 'Öncekini bul', accelerator: 'CmdOrCtrl+Shift+G', click: () => actions.findNext(false) },
      ],
    },
    {
      label: 'Yer imleri',
      submenu: [
        { label: 'Bu sayfayı yer imlerine ekle/kaldır', accelerator: 'CmdOrCtrl+D', click: actions.toggleBookmark },
        { label: 'Tüm yer imleri', accelerator: 'CmdOrCtrl+Alt+B', click: actions.showBookmarks },
      ],
    },
    {
      label: 'Sekme',
      submenu: [
        { label: 'Sonraki sekme', accelerator: 'Ctrl+Tab', click: actions.selectNextTab },
        { label: 'Önceki sekme', accelerator: 'Ctrl+Shift+Tab', click: actions.selectPreviousTab },
        { label: 'Sekmeyi yeni pencereye taşı', click: actions.moveTabToNewWindow },
        // ⌘1–⌘8 select a tab by position and ⌘9 the last one; hidden to keep the menu short.
        ...Array.from({ length: 9 }, (_, i): MenuItemConstructorOptions => ({
          label: i === 8 ? 'Son sekme' : `Sekme ${i + 1}`,
          accelerator: `CmdOrCtrl+${i + 1}`,
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => actions.selectTab(i === 8 ? -1 : i),
        })),
      ],
    },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Yenile', accelerator: 'CmdOrCtrl+R', click: actions.reload },
        { type: 'separator' },
        { label: 'Gerçek boyut', accelerator: 'CmdOrCtrl+0', click: () => actions.zoom(0) },
        { label: 'Yakınlaştır', accelerator: 'CmdOrCtrl+Plus', click: () => actions.zoom(1) },
        // ⌘= is the unshifted key of ⌘+ on most layouts.
        {
          label: 'Yakınlaştır',
          accelerator: 'CmdOrCtrl+=',
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => actions.zoom(1),
        },
        { label: 'Uzaklaştır', accelerator: 'CmdOrCtrl+-', click: () => actions.zoom(-1) },
        { label: 'Sekme panelini daralt/genişlet', accelerator: 'CmdOrCtrl+S', click: actions.togglePanel },
        { type: 'separator' },
        { label: 'Sayfa kaynağı', accelerator: 'Alt+CmdOrCtrl+U', click: actions.viewSource },
        { label: 'Sayfa DevTools', accelerator: 'Alt+CmdOrCtrl+I', click: actions.toggleDevTools },
        { label: 'Telefon görünümü', accelerator: 'Alt+CmdOrCtrl+M', click: actions.toggleDeviceView },
        {
          label: 'Cihaz',
          submenu: actions.devices.map((device) => ({
            label: device.label,
            type: 'radio' as const,
            checked: device.checked,
            click: () => actions.selectDevice(device.id),
          })),
        },
        { label: 'Cihazı döndür', accelerator: 'Shift+Alt+CmdOrCtrl+M', click: actions.rotateDevice },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
