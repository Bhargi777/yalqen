import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  BrowserState,
  ChromeLayout,
  IpcChannel,
  UiAction,
  Wallpaper,
  YalqenApi,
} from '../shared/types.js';

const channel: typeof IpcChannel = {
  getState: 'yalqen:get-state',
  state: 'yalqen:state',
  setLayout: 'yalqen:set-layout',
  action: 'yalqen:action',
  wallpaper: 'yalqen:wallpaper',
};

function subscribe<T>(name: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(name, handler);
  return () => ipcRenderer.off(name, handler);
}

const api: YalqenApi = {
  getState: () => ipcRenderer.invoke(channel.getState) as Promise<BrowserState>,
  onState: (listener) => subscribe<BrowserState>(channel.state, listener),
  onWallpaper: (listener) => subscribe<Wallpaper | null>(channel.wallpaper, listener),
  setLayout: (layout: ChromeLayout) => ipcRenderer.send(channel.setLayout, layout),
  send: (action: UiAction) => ipcRenderer.send(channel.action, action),
};

contextBridge.exposeInMainWorld('yalqen', api);
