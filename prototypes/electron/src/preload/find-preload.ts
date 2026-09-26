import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { FindBarAction, FindBarApi, FindBarChannel, FindResult } from '../shared/types.js';

// Sandboxed preloads cannot require local modules, so channel names are
// repeated here and checked against the shared definition at compile time.
const channel: typeof FindBarChannel = {
  open: 'yalqen-find:open',
  result: 'yalqen-find:result',
  action: 'yalqen-find:action',
};

const api: FindBarApi = {
  onOpen: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(channel.open, handler);
    return () => ipcRenderer.off(channel.open, handler);
  },
  onResult: (listener) => {
    const handler = (_event: IpcRendererEvent, result: FindResult) => listener(result);
    ipcRenderer.on(channel.result, handler);
    return () => ipcRenderer.off(channel.result, handler);
  },
  send: (action: FindBarAction) => ipcRenderer.send(channel.action, action),
};

contextBridge.exposeInMainWorld('yalqenFind', api);
