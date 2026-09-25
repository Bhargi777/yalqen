import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_VISITS = 5000;

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
}

/** Browser-wide visit history, independent of open tabs and session restore. */
export class HistoryStore {
  private readonly file: string;
  private entries: HistoryEntry[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(directory: string) {
    this.file = path.join(directory, 'history.json');
    try {
      const data: unknown = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(data)) {
        this.entries = data.filter(isHistoryEntry).slice(0, MAX_VISITS);
      }
    } catch {
      // No history file yet, or a damaged file. Start with an empty list.
    }
  }

  list(query = ''): HistoryEntry[] {
    const term = query.trim().toLocaleLowerCase('tr').slice(0, 200);
    if (!term) return [...this.entries];
    return this.entries.filter((entry) =>
      `${entry.title} ${entry.url}`.toLocaleLowerCase('tr').includes(term),
    );
  }

  visit(url: string, title: string): string | null {
    if (!isWebUrl(url)) return null;
    const entry = { id: randomUUID(), url, title: title || url, visitedAt: Date.now() };
    this.entries.unshift(entry);
    if (this.entries.length > MAX_VISITS) this.entries.length = MAX_VISITS;
    this.scheduleSave();
    return entry.id;
  }

  setTitle(id: string | null, title: string): void {
    if (!id || !title) return;
    const entry = this.entries.find((item) => item.id === id);
    if (!entry || entry.title === title) return;
    entry.title = title;
    this.scheduleSave();
  }

  remove(id: string): void {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    this.entries.splice(index, 1);
    this.scheduleSave();
  }

  clear(): void {
    this.entries = [];
    this.saveNow();
  }

  saveNow(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(this.entries));
      fs.renameSync(temp, this.file);
    } catch (error) {
      console.warn('[history] could not save visits:', error);
    }
  }

  private scheduleSave(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), 500);
  }
}

function isWebUrl(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HistoryEntry>;
  return typeof entry.id === 'string' && typeof entry.url === 'string' &&
    isWebUrl(entry.url) && typeof entry.title === 'string' &&
    typeof entry.visitedAt === 'number' && Number.isFinite(entry.visitedAt);
}
