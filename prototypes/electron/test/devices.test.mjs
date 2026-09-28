import assert from 'node:assert/strict';
import { test } from 'node:test';
import devices from '../dist/main/devices.js';

const { applyDeviceMetrics, applyEmulation } = devices;
const emulation = { deviceId: 'iphone-15', landscape: false };

function fakeContents() {
  const commands = [];
  const debuggerSession = {
    isAttached: () => true,
    sendCommand: async (name, params) => {
      commands.push({ name, params });
    },
  };
  return { commands, contents: { debugger: debuggerSession } };
}

test('resizing a device only updates its metrics', async () => {
  const { commands, contents } = fakeContents();
  await applyDeviceMetrics(contents, emulation, 0.8);
  assert.deepEqual(
    commands.map(({ name }) => name),
    ['Emulation.setDeviceMetricsOverride'],
  );
  assert.equal(commands[0].params.scale, 0.8);
});

test('entering device mode still applies touch and user agent settings', async () => {
  const { commands, contents } = fakeContents();
  await applyEmulation(contents, emulation, 1);
  assert.deepEqual(
    commands.map(({ name }) => name),
    [
      'Emulation.setDeviceMetricsOverride',
      'Emulation.setTouchEmulationEnabled',
      'Emulation.setEmitTouchEventsForMouse',
      'Emulation.setUserAgentOverride',
    ],
  );
});

test('a device fits inside the page and is centred below its label', () => {
  const page = { x: 0, y: 0, width: 1000, height: 800 };
  const frame = devices.fitDevice(emulation, page);
  assert.equal(frame.label, 'iPhone 15');
  assert.ok(frame.scale < 1);
  assert.ok(frame.viewHeight <= page.height - 2 * 32 - 24);
  assert.equal(frame.x, Math.round((page.width - frame.viewWidth) / 2));
  const landscape = devices.fitDevice(
    { deviceId: 'iphone-15', landscape: true },
    { x: 0, y: 0, width: 3000, height: 3000 },
  );
  assert.deepEqual([landscape.width, landscape.height, landscape.scale], [852, 393, 1]);
  assert.equal(devices.fitDevice(emulation, { x: 0, y: 0, width: 10, height: 10 }).scale, 0.25);
});

const responsive = { deviceId: 'responsive', landscape: false };

test('the responsive frame resizes within limits, phones do not', () => {
  const resized = devices.resizeEmulation(responsive, { width: 375.4, height: 50000 });
  assert.deepEqual(resized.size, { width: 375, height: 4000 });
  assert.deepEqual(devices.resizeEmulation(responsive, { width: Number.NaN, height: 10 }).size, {
    width: 1024,
    height: 200,
  });
  assert.equal(devices.resizeEmulation(emulation, { width: 500, height: 500 }), emulation);
  const frame = devices.fitDevice(resized, { x: 0, y: 0, width: 3000, height: 5000 });
  assert.deepEqual([frame.width, frame.height, frame.resizable, frame.deviceScaleFactor], [375, 4000, true, 1]);
  assert.equal(devices.fitDevice(emulation, { x: 0, y: 0, width: 3000, height: 3000 }).resizable, false);
});

test('rotating swaps a responsive size but toggles landscape on phones', () => {
  const rotated = devices.rotateEmulation({ ...responsive, size: { width: 800, height: 600 } });
  assert.deepEqual([rotated.landscape, rotated.size], [false, { width: 600, height: 800 }]);
  assert.equal(devices.rotateEmulation(emulation).landscape, true);
});

test('only the responsive frame takes a chosen pixel ratio', () => {
  assert.equal(devices.scaleEmulation(responsive, 2).scaleFactor, 2);
  assert.equal(devices.scaleEmulation(responsive, 7), responsive);
  assert.equal(devices.scaleEmulation(emulation, 2), emulation);
});

test('the responsive frame is emulated as a desktop page', async () => {
  const { commands, contents } = fakeContents();
  await applyEmulation(contents, { ...responsive, scaleFactor: 2 }, 1);
  const byName = Object.fromEntries(commands.map(({ name, params }) => [name, params]));
  assert.equal(byName['Emulation.setDeviceMetricsOverride'].mobile, false);
  assert.equal(byName['Emulation.setDeviceMetricsOverride'].deviceScaleFactor, 2);
  assert.equal(byName['Emulation.setTouchEmulationEnabled'].enabled, false);
  assert.equal(byName['Emulation.setUserAgentOverride'].userAgent, '');
});
