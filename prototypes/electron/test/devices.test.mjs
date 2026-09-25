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
