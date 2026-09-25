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
  keepAlive: boolean;
  history: SavedHistory | null;
}

export interface SavedSession {
  version: 1;
  activeTabId: TabId | null;
  tabs: SavedTab[];
}

export class SessionStore {
  private readonly file: string;
  private timer: NodeJS.Timeout | null = null;

  constructor(directory: string) {
    this.file = path.join(directory, 'tabs.json');
  }

  load(): SavedSession | null {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8')) as SavedSession;
      return data.version === 1 && Array.isArray(data.tabs) ? data : null;
    } catch {
      return null;
    }
  }

  /** Coalesces frequent changes into one write. */
  scheduleSave(snapshot: () => SavedSession, delayMs = 500): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.saveNow(snapshot());
    }, delayMs);
  }

  saveNow(session: SavedSession): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // Write to a temporary file first so a crash never leaves a truncated file.
    const temp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(session));
    fs.renameSync(temp, this.file);
  }
}
