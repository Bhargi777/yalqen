import fs from 'node:fs';
import path from 'node:path';
import type { NavigationEntry } from 'electron';
import type { TabId } from '../shared/types.js';

export interface SavedHistory {
  entries: NavigationEntry[];
  index: number;
}

export interface SavedTab {
  id: TabId;
  url: string;
  title: string;
  faviconUrl: string | null;
  pinnedUrl?: string | null;
  keepAlive?: boolean;
  history: SavedHistory | null;
}

export interface SavedWindow {
  activeTabId: TabId | null;
  tabs: SavedTab[];
}

export interface SavedSession {
  version: 2;
  windows: SavedWindow[];
}

function isSavedWindow(value: unknown): value is SavedWindow {
  const window = value as SavedWindow;
  return typeof window === 'object' && window !== null && Array.isArray(window.tabs);
}

export class SessionStore {
  private readonly file: string;
  private timer: NodeJS.Timeout | null = null;
  private generation = 0;
  private closed = false;

  constructor(directory: string) {
    this.file = path.join(directory, 'tabs.json');
  }

  load(): SavedSession | null {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8')) as
        | SavedSession
        | ({ version: 1 } & SavedWindow);
      if (data.version === 1) {
        return isSavedWindow(data) ? { version: 2, windows: [{ activeTabId: data.activeTabId ?? null, tabs: data.tabs }] } : null;
      }
      return data.version === 2 && Array.isArray(data.windows)
        ? { version: 2, windows: data.windows.filter(isSavedWindow) }
        : null;
    } catch {
      return null;
    }
  }

  scheduleSave(snapshot: () => SavedSession, delayMs = 500): void {
    if (this.closed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.saveInBackground(snapshot());
    }, delayMs);
  }

  private async saveInBackground(session: SavedSession): Promise<void> {
    const generation = ++this.generation;
    const temp = `${this.file}.${generation}.tmp`;
    try {
      await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
      await fs.promises.writeFile(temp, JSON.stringify(session));
      if (this.closed || generation !== this.generation) {
        await fs.promises.rm(temp, { force: true });
        return;
      }
      fs.renameSync(temp, this.file);
    } catch (error) {
      console.warn('[session] could not save tabs:', error);
      await fs.promises.rm(temp, { force: true }).catch(() => {});
    }
  }

  saveNow(session: SavedSession): void {
    this.closed = true;
    this.generation++;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const temp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(session));
    fs.renameSync(temp, this.file);
  }
}
