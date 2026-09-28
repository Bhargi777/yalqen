import { webContents, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { SETTINGS_URL, SettingsChannel, type SettingsView } from '../shared/types.js';

const settings = new URL(SETTINGS_URL);

function isSettingsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === settings.protocol && parsed.host === settings.host;
  } catch {
    return false;
  }
}

export function isSettingsFrame(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  return !!frame && frame === event.sender.mainFrame && isSettingsUrl(frame.url);
}

export function broadcastSettings(view: SettingsView): void {
  for (const contents of webContents.getAllWebContents()) {
    if (!contents.isDestroyed() && isSettingsUrl(contents.mainFrame.url)) contents.send(SettingsChannel.changed, view);
  }
}
