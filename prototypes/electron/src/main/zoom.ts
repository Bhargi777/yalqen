import fs from 'node:fs';
import path from 'node:path';

/** Zoom steps of the shortcuts, as in Chromium. */
export const ZOOM_FACTORS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
const MIN_FACTOR = ZOOM_FACTORS[0];
const MAX_FACTOR = ZOOM_FACTORS[ZOOM_FACTORS.length - 1];
const EPSILON = 0.001;

/** The step after `current` in `direction`, staying at either end. */
export function stepZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_FACTORS.find((factor) => factor > current + EPSILON) ?? MAX_FACTOR;
  return ZOOM_FACTORS.findLast((factor) => factor < current - EPSILON) ?? MIN_FACTOR;
}

/** Zoom is remembered per host, like Chromium applies it; other pages are not remembered. */
export function zoomKey(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === 'http:' || protocol === 'https:') && hostname !== '' ? hostname : null;
  } catch {
    return null;
  }
}

interface SavedZoom {
  version: 1;
  sites: Record<string, number>;
}

/** Zoom factors people chose for sites; sites at actual size are not stored. */
export class ZoomStore {
  readonly file: string;
  private readonly sites = new Map<string, number>();

  constructor(directory: string) {
    this.file = path.join(directory, 'zoom.json');
    this.load();
  }

  /** The remembered factor for `url`'s site, or 1. */
  get(url: string): number {
    const key = zoomKey(url);
    return (key === null ? undefined : this.sites.get(key)) ?? 1;
  }

  set(url: string, factor: number): void {
    const key = zoomKey(url);
    if (!key || !Number.isFinite(factor)) return;
    const clamped = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, factor));
    if (Math.abs(clamped - 1) < EPSILON) {
      if (!this.sites.delete(key)) return;
    } else {
      if (this.sites.get(key) === clamped) return;
      this.sites.set(key, clamped);
    }
    this.save();
  }

  private load(): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8')) as SavedZoom;
      if (data.version !== 1 || typeof data.sites !== 'object' || data.sites === null) return;
      for (const [key, factor] of Object.entries(data.sites)) {
        if (typeof factor === 'number' && factor >= MIN_FACTOR && factor <= MAX_FACTOR) {
          this.sites.set(key, factor);
        }
      }
    } catch {
      // Missing or unreadable: every site starts at actual size.
    }
  }

  private save(): void {
    const data: SavedZoom = { version: 1, sites: Object.fromEntries(this.sites) };
    const temp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(temp, JSON.stringify(data));
      fs.renameSync(temp, this.file);
    } catch (error) {
      console.warn('[zoom] could not save zoom levels:', error);
    }
  }
}
