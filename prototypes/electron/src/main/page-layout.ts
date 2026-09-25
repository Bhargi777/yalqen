import type { ChromeLayout } from '../shared/types.js';

export interface PageFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

/** Full screen removes every browser inset so a site's video can fill the display. */
export function pageFrame(width: number, height: number, layout: ChromeLayout, fullScreen: boolean): PageFrame {
  if (fullScreen) return { x: 0, y: 0, width, height, radius: 0 };
  return {
    x: layout.panelSide === 'left' ? layout.panelWidth : layout.pageInset,
    y: layout.chromeHeight,
    width: Math.max(0, width - layout.panelWidth - layout.pageInset),
    height: Math.max(0, height - layout.chromeHeight - layout.pageInset),
    radius: layout.pageRadius,
  };
}
