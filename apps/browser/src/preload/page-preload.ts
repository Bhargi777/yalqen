import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  NEW_TAB_URL,
  PageChannel,
  SETTINGS_URL,
  SettingsChannel as settingsChannel,
  type ClearDataRequest,
  type NewTabCenter,
  type SettingsApi,
  type SettingsValues,
  type SettingsView,
} from '../shared/types.js';

const THRESHOLD = 90;
const GAP_MS = 350;
const COOLDOWN_MS = 650;
const PENDING_CENTER_MS = 250;

let distance = 0;
let lastAt = 0;
let navigatedAt = 0;

if (location.href === NEW_TAB_URL && window === window.top) {
  let centerOffset = 0;
  let pending: NewTabCenter | null = null;
  let pendingTimer = 0;
  const applyCenterOffset = () => {
    document.documentElement?.style.setProperty('--newtab-center-offset', `${centerOffset}px`);
  };
  const apply = (offset: number) => {
    pending = null;
    clearTimeout(pendingTimer);
    centerOffset = offset;
    applyCenterOffset();
  };
  // An offset meant for a new page width waits for the matching resize, so both land in the same frame.
  const receive = (center: NewTabCenter | undefined) => {
    if (!center || !Number.isFinite(center.offset)) return;
    if (center.width === null || Math.abs(window.innerWidth - center.width) < 1) {
      apply(center.offset);
      return;
    }
    pending = center;
    clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => apply(center.offset), PENDING_CENTER_MS);
  };
  window.addEventListener('resize', () => {
    if (pending) receive(pending);
  });
  ipcRenderer.on(PageChannel.newTabCenter, (_event, center: NewTabCenter) => receive(center));
  receive(ipcRenderer.sendSync(PageChannel.newTabCenter));
  window.addEventListener('DOMContentLoaded', applyCenterOffset, { once: true });
}

function hasHorizontalScroller(event: WheelEvent): boolean {
  for (const target of event.composedPath()) {
    if (!(target instanceof Element)) continue;
    const style = getComputedStyle(target);
    if (!['auto', 'scroll', 'overlay'].includes(style.overflowX)) continue;
    if (target.scrollWidth > target.clientWidth + 1) return true;
  }
  return (
    document.scrollingElement !== null &&
    document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth + 1
  );
}

window.addEventListener(
  'wheel',
  (event) => {
    if (!event.isTrusted) return;
    if (
      event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    if (Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.25 || hasHorizontalScroller(event)) {
      distance = 0;
      return;
    }

    const now = performance.now();
    if (now - navigatedAt < COOLDOWN_MS) return;
    if (now - lastAt > GAP_MS || Math.sign(event.deltaX) !== Math.sign(distance)) distance = 0;
    lastAt = now;
    distance += event.deltaX;
    if (Math.abs(distance) < THRESHOLD) return;

    ipcRenderer.send(PageChannel.swipe, distance < 0 ? 'back' : 'forward');
    navigatedAt = now;
    distance = 0;
  },
  { capture: true, passive: true },
);

if (location.href.startsWith(SETTINGS_URL) && window === window.top) {
  const api: SettingsApi = {
    get: () => ipcRenderer.invoke(settingsChannel.get) as Promise<SettingsView>,
    update: (patch: Partial<SettingsValues>) =>
      ipcRenderer.invoke(settingsChannel.update, patch) as Promise<SettingsView>,
    clearData: (request: ClearDataRequest) => ipcRenderer.invoke(settingsChannel.clearData, request) as Promise<void>,
    makeDefault: () => ipcRenderer.invoke(settingsChannel.makeDefault) as Promise<SettingsView>,
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, view: SettingsView) => listener(view);
      ipcRenderer.on(settingsChannel.changed, handler);
      return () => ipcRenderer.off(settingsChannel.changed, handler);
    },
  };
  contextBridge.exposeInMainWorld('yalqenSettings', api);
}
