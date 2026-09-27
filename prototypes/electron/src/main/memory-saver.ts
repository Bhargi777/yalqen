export const DISCARD_AFTER_MINUTES = [0, 15, 30, 60, 120] as const;
export const DEFAULT_DISCARD_AFTER_MINUTES = 30;
export const DISCARD_CHECK_MS = 60_000;

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

export function shouldDiscard(tab: DiscardCandidate, now: number, afterMinutes: number): boolean {
  if (afterMinutes <= 0 || !tab.live || tab.active || tab.pinned || tab.loading) return false;
  if (tab.audible || tab.devToolsOpen || tab.edited) return false;
  return now - tab.inactiveSince >= afterMinutes * 60_000;
}
