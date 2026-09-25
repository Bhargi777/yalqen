import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  CommandBarAction,
  CommandBarApi,
  CommandBarChannel,
  CommandBarOpen,
} from '../shared/types.js';

// Sandboxed preloads cannot require local modules, so channel names are
// repeated here and checked against the shared definition at compile time.
const channel: typeof CommandBarChannel = {
  open: 'yalqen-command:open',
  action: 'yalqen-command:action',
};

const api: CommandBarApi = {
  onOpen: (listener) => {
    const handler = (_event: IpcRendererEvent, open: CommandBarOpen) => listener(open);
    ipcRenderer.on(channel.open, handler);
    return () => ipcRenderer.off(channel.open, handler);
  },
  send: (action: CommandBarAction) => ipcRenderer.send(channel.action, action),
};

contextBridge.exposeInMainWorld('yalqenCommand', api);
