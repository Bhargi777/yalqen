import type { MenuItemConstructorOptions } from 'electron';

/** How long a click or key press lets a page open one new window, as in Chromium. */
export const ACTIVATION_MS = 5000;
/** Blocked addresses kept per tab. */
export const MAX_BLOCKED = 10;
const LABEL_LENGTH = 60;

/** Input that counts as the user activating a page. */
export function isActivation(inputType: string): boolean {
  return ['mouseDown', 'mouseUp', 'rawKeyDown', 'keyDown', 'touchEnd', 'gestureTap'].includes(inputType);
}

/** Whether a page may open a new window now; `activatedAt` is its last user input. */
export function mayOpenWindow(activatedAt: number, now: number, allowedForSite: boolean): boolean {
  return allowedForSite || (activatedAt > 0 && now - activatedAt <= ACTIVATION_MS);
}

/** Adds a blocked address, keeping the newest `MAX_BLOCKED`; only web addresses can be opened later. */
export function recordBlocked(blocked: readonly string[], url: string): string[] {
  if (!/^https?:/i.test(url)) return [...blocked];
  return [...blocked.filter((item) => item !== url), url].slice(-MAX_BLOCKED);
}

export interface BlockedPopupsActions {
  open(url: string): void;
  allowSite(): void;
}

/** Menu of the blocked pop-ups indicator. */
export function blockedPopupsTemplate(
  host: string,
  blocked: readonly string[],
  actions: BlockedPopupsActions,
): MenuItemConstructorOptions[] {
  return [
    { label: 'Açılır pencere engellendi', enabled: false },
    ...blocked.map((url) => ({
      label: url.length > LABEL_LENGTH ? `${url.slice(0, LABEL_LENGTH - 1)}…` : url,
      click: () => actions.open(url),
    })),
    { type: 'separator' },
    { label: `${host} için açılır pencerelere her zaman izin ver`, click: actions.allowSite },
  ];
}
