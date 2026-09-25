import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  BrowserState,
  ChromeLayout,
  IpcChannel,
  UiAction,
  UiCommand,
  YalqenApi,
} from '../shared/types.js';

// Sandboxed preloads cannot require local modules, so channel names are
// repeated here and checked against the shared definition at compile time.
const channel: typeof IpcChannel = {
  getState: 'yalqen:get-state',
  state: 'yalqen:state',
  command: 'yalqen:command',
  setLayout: 'yalqen:set-layout',
  action: 'yalqen:action',
};

function subscribe<T>(name: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(name, handler);
  return () => ipcRenderer.off(name, handler);
}

const api: YalqenApi = {
  getState: () => ipcRenderer.invoke(channel.getState) as Promise<BrowserState>,
  onState: (listener) => subscribe<BrowserState>(channel.state, listener),
  onCommand: (listener) => subscribe<UiCommand>(channel.command, listener),
  setLayout: (layout: ChromeLayout) => ipcRenderer.send(channel.setLayout, layout),
  send: (action: UiAction) => ipcRenderer.send(channel.action, action),
};

contextBridge.exposeInMainWorld('yalqen', api);
