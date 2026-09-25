import fs from 'node:fs/promises';
import path from 'node:path';
import { ElectronBlocker, adsLists } from '@ghostery/adblocker-electron';
import { ipcMain, powerMonitor, type Session } from 'electron';

// Peter Lowe's list forbids commercial use; the rest are GPL3 or CC BY-SA.
const FILTER_LISTS = adsLists.filter((url) => !url.includes('/peter-lowe/'));
// Use cached filters immediately; refresh old lists after the computer is idle.
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_REFRESH_DELAY_MS = 30_000;
const MIN_IDLE_SECONDS = 10;
const COSMETIC_FILTERS_CHANNEL = '@ghostery/adblocker/inject-cosmetic-filters';
const MUTATION_OBSERVER_CHANNEL = '@ghostery/adblocker/is-mutation-observer-enabled';

/** Blocks ads in one session. The engine is loaded the first time blocking is enabled. */
export class AdBlocker {
  private blocker: ElectronBlocker | null = null;
  private loading: Promise<void> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshing = false;
  private stale = false;
  private wanted = false;
  private destroyed = false;

  constructor(
    private readonly session: Session,
    private readonly cacheFile: string,
  ) {}

  /** Applies to requests and pages loaded from now on. */
  setEnabled(enabled: boolean): void {
    if (this.destroyed) return;
    this.wanted = enabled;
    if (!enabled && this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.blocker) this.apply(this.blocker);
    else if (enabled) this.loading ??= this.load();
    if (enabled && this.stale) this.scheduleRefresh();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private async load(): Promise<void> {
    try {
      const { blocker, stale } = await loadEngine(this.cacheFile);
      if (this.destroyed) return;
      this.blocker = blocker;
      this.stale = stale;
      this.apply(this.blocker);
      if (this.wanted && stale) this.scheduleRefresh();
    } catch (error) {
      console.warn('[adblock] filters could not be loaded:', error);
    } finally {
      this.loading = null;
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer || this.refreshing || this.destroyed) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      if (!this.wanted || this.destroyed) return;
      if (powerMonitor.getSystemIdleTime() < MIN_IDLE_SECONDS) {
        this.scheduleRefresh();
        return;
      }
      void this.refresh();
    }, CACHE_REFRESH_DELAY_MS);
  }

  private async refresh(): Promise<void> {
    this.refreshing = true;
    try {
      const next = await fetchEngine(this.cacheFile);
      if (this.destroyed) return;
      if (this.blocker?.isBlockingEnabled(this.session)) {
        this.blocker.disableBlockingInSession(this.session);
      }
      this.blocker = next;
      this.stale = false;
      this.apply(next);
    } catch (error) {
      console.warn('[adblock] filter refresh failed:', error);
    } finally {
      this.refreshing = false;
    }
  }

  private apply(blocker: ElectronBlocker): void {
    if (this.wanted === blocker.isBlockingEnabled(this.session)) return;
    if (this.wanted) {
      // Ghostery registers these handlers when blocking starts. Remove the
      // placeholders left for pages that were already running when it stopped.
      ipcMain.removeHandler(COSMETIC_FILTERS_CHANNEL);
      ipcMain.removeHandler(MUTATION_OBSERVER_CHANNEL);
      blocker.enableBlockingInSession(this.session);
    } else {
      blocker.disableBlockingInSession(this.session);
      // Existing frames retain Ghostery's preload after it is unregistered.
      // Their later IPC calls must still get a harmless response.
      ipcMain.handle(COSMETIC_FILTERS_CHANNEL, () => undefined);
      ipcMain.handle(MUTATION_OBSERVER_CHANNEL, () => false);
    }
  }
}

export async function loadEngine(cacheFile: string): Promise<{ blocker: ElectronBlocker; stale: boolean }> {
  try {
    const { mtimeMs } = await fs.stat(cacheFile);
    const blocker = ElectronBlocker.deserialize(await fs.readFile(cacheFile));
    return { blocker, stale: Date.now() - mtimeMs > CACHE_MAX_AGE_MS };
  } catch {
    // No usable cache yet: fetch once so blocking can start.
    return { blocker: await fetchEngine(cacheFile), stale: false };
  }
}

async function fetchEngine(cacheFile: string): Promise<ElectronBlocker> {
  const blocker = await ElectronBlocker.fromLists(fetch, FILTER_LISTS);
  const temp = `${cacheFile}.tmp`;
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  await fs.writeFile(temp, blocker.serialize());
  await fs.rename(temp, cacheFile);
  return blocker;
}
