import { ipcRenderer } from 'electron';

const CHANNEL = 'yalqen:page-swipe';
const THRESHOLD = 90;
const GAP_MS = 350;
const COOLDOWN_MS = 650;

let distance = 0;
let lastAt = 0;
let navigatedAt = 0;

function hasHorizontalScroller(event: WheelEvent): boolean {
  for (const target of event.composedPath()) {
    if (!(target instanceof Element)) continue;
    const style = getComputedStyle(target);
    if (!['auto', 'scroll', 'overlay'].includes(style.overflowX)) continue;
    if (target.scrollWidth > target.clientWidth + 1) return true;
  }
  return document.scrollingElement !== null &&
    document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth + 1;
}

window.addEventListener('wheel', (event) => {
  if (!event.isTrusted) return;
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
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

  ipcRenderer.send(CHANNEL, distance < 0 ? 'back' : 'forward');
  navigatedAt = now;
  distance = 0;
}, { capture: true, passive: true });
