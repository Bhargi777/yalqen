import assert from 'node:assert/strict';
import { test } from 'node:test';
import devices from '../dist/main/devices.js';

const { applyDeviceMetrics, applyEmulation } = devices;
const emulation = { deviceId: 'iphone-15', landscape: false };

function fakeContents() {
  const commands = [];
  const debuggerSession = {
    isAttached: () => true,
    sendCommand: async (name, params) => { commands.push({ name, params }); },
  };
  return { commands, contents: { debugger: debuggerSession } };
}

test('resizing a device only updates its metrics', async () => {
  const { commands, contents } = fakeContents();
  await applyDeviceMetrics(contents, emulation, 0.8);
  assert.deepEqual(commands.map(({ name }) => name), ['Emulation.setDeviceMetricsOverride']);
  assert.equal(commands[0].params.scale, 0.8);
});

test('entering device mode still applies touch and user agent settings', async () => {
  const { commands, contents } = fakeContents();
  await applyEmulation(contents, emulation, 1);
  assert.deepEqual(commands.map(({ name }) => name), [
    'Emulation.setDeviceMetricsOverride',
    'Emulation.setTouchEmulationEnabled',
    'Emulation.setEmitTouchEventsForMouse',
    'Emulation.setUserAgentOverride',
  ]);
});

test('a device fits inside the page and is centred below its label', () => {
  const page = { x: 0, y: 0, width: 1000, height: 800 };
  const frame = devices.fitDevice(emulation, page);
  assert.equal(frame.label, 'iPhone 15');
  assert.ok(frame.scale < 1);
  assert.ok(frame.viewHeight <= page.height - 2 * 32 - 24);
  assert.equal(frame.x, Math.round((page.width - frame.viewWidth) / 2));
  const landscape = devices.fitDevice({ deviceId: 'iphone-15', landscape: true }, { x: 0, y: 0, width: 3000, height: 3000 });
  assert.deepEqual([landscape.width, landscape.height, landscape.scale], [852, 393, 1]);
  assert.equal(devices.fitDevice(emulation, { x: 0, y: 0, width: 10, height: 10 }).scale, 0.25);
});
