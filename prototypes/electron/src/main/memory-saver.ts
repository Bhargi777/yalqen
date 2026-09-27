import { execFile } from 'node:child_process';

export const DISCARD_AFTER_MINUTES = [0, 15, 30, 60, 120] as const;
export const DEFAULT_DISCARD_AFTER_MINUTES = 30;
export const DISCARD_CHECK_MS = 15_000;
export const PRESSURE_MIN_IDLE_MS = 60_000;

export type MemoryPressure = 'normal' | 'warning' | 'critical';

export interface DiscardCandidate {
  live: boolean;
  active: boolean;
  pinned: boolean;
  loading: boolean;
  audible: boolean;
  devToolsOpen: boolean;
  edited: boolean;
  inactiveSince: number;
}

export function isDiscardAfterMinutes(value: unknown): value is (typeof DISCARD_AFTER_MINUTES)[number] {
  return (DISCARD_AFTER_MINUTES as readonly unknown[]).includes(value);
}

function isDiscardable(tab: DiscardCandidate): boolean {
  return tab.live && !tab.active && !tab.pinned && !tab.loading && !tab.audible && !tab.devToolsOpen && !tab.edited;
}

export function shouldDiscard(tab: DiscardCandidate, now: number, afterMinutes: number): boolean {
  return afterMinutes > 0 && isDiscardable(tab) && now - tab.inactiveSince >= afterMinutes * 60_000;
}

export function pressureVictim<T extends DiscardCandidate>(tabs: readonly T[], now: number): T | null {
  let oldest: T | null = null;
  for (const tab of tabs) {
    if (!isDiscardable(tab) || now - tab.inactiveSince < PRESSURE_MIN_IDLE_MS) continue;
    if (!oldest || tab.inactiveSince < oldest.inactiveSince) oldest = tab;
  }
  return oldest;
}

export function readMemoryPressure(): Promise<MemoryPressure> {
  if (process.platform !== 'darwin') return Promise.resolve('normal');
  return new Promise((resolve) => {
    execFile('sysctl', ['-n', 'kern.memorystatus_vm_pressure_level'], (error, stdout) => {
      resolve(error ? 'normal' : parsePressureLevel(stdout));
    });
  });
}

export function parsePressureLevel(output: string): MemoryPressure {
  const level = Number(output.trim());
  if (level >= 4) return 'critical';
  if (level >= 2) return 'warning';
  return 'normal';
}
