import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ClearDataRequest, SettingsApi, SettingsChannel, SettingsValues, SettingsView } from '../shared/types.js';

const channel: typeof SettingsChannel = {
  get: 'yalqen-settings:get',
  update: 'yalqen-settings:update',
  changed: 'yalqen-settings:changed',
  clearData: 'yalqen-settings:clear-data',
  makeDefault: 'yalqen-settings:make-default',
};

const api: SettingsApi = {
  get: () => ipcRenderer.invoke(channel.get) as Promise<SettingsView>,
  update: (patch: Partial<SettingsValues>) =>
    ipcRenderer.invoke(channel.update, patch) as Promise<SettingsView>,
  clearData: (request: ClearDataRequest) => ipcRenderer.invoke(channel.clearData, request) as Promise<void>,
  makeDefault: () => ipcRenderer.invoke(channel.makeDefault) as Promise<SettingsView>,
  onChange: (listener) => {
    const handler = (_event: IpcRendererEvent, view: SettingsView) => listener(view);
    ipcRenderer.on(channel.changed, handler);
    return () => ipcRenderer.off(channel.changed, handler);
  },
};

contextBridge.exposeInMainWorld('yalqenSettings', api);
