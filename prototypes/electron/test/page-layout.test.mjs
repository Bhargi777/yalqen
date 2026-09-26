import assert from 'node:assert/strict';
import test from 'node:test';
import { pageFrame } from '../dist/main/page-layout.js';

const layout = {
  panelWidth: 220,
  panelSide: 'left',
  windowControls: false,
  chromeHeight: 44,
  pageInset: 8,
  pageRadius: 16,
};

test('a page full screen player gets the entire window without rounded corners', () => {
  assert.deepEqual(pageFrame(1280, 820, layout, true), {
    x: 0,
    y: 0,
    width: 1280,
    height: 820,
    radius: 0,
  });
});

test('normal browsing keeps browser chrome spacing even at full screen window dimensions', () => {
  assert.deepEqual(pageFrame(2560, 1440, layout, false), {
    x: 220,
    y: 44,
    width: 2332,
    height: 1388,
    radius: 16,
  });
  assert.deepEqual(pageFrame(1280, 820, layout, false), {
    x: 220,
    y: 44,
    width: 1052,
    height: 768,
    radius: 16,
  });
  assert.deepEqual(pageFrame(1280, 820, { ...layout, panelSide: 'right' }, false), {
    x: 8,
    y: 44,
    width: 1052,
    height: 768,
    radius: 16,
  });
});

test('hidden menus leave no panel rail', () => {
  assert.deepEqual(pageFrame(1280, 820, { ...layout, panelWidth: 8 }, false), {
    x: 8,
    y: 44,
    width: 1264,
    height: 768,
    radius: 16,
  });
});
