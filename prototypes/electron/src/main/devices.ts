import type { Rectangle, WebContents } from 'electron';
import type { DeviceFrame, DeviceId } from '../shared/types.js';

export interface Device {
  id: DeviceId;
  label: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  cornerRadius: number;
  userAgent: string;
  platform: string;
}

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

export const DEVICES: readonly Device[] = [
  { id: 'iphone-15', label: 'iPhone 15', width: 393, height: 852, deviceScaleFactor: 3, cornerRadius: 47, userAgent: IOS_UA, platform: 'iPhone' },
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2, cornerRadius: 0, userAgent: IOS_UA, platform: 'iPhone' },
  { id: 'pixel-8', label: 'Pixel 8', width: 412, height: 915, deviceScaleFactor: 2.625, cornerRadius: 32, userAgent: ANDROID_UA, platform: 'Linux armv8l' },
  { id: 'ipad-mini', label: 'iPad mini', width: 744, height: 1133, deviceScaleFactor: 2, cornerRadius: 18, userAgent: IPAD_UA, platform: 'iPad' },
];

export const DEFAULT_DEVICE_ID: DeviceId = 'iphone-15';

export function findDevice(id: DeviceId): Device {
  return DEVICES.find((device) => device.id === id) ?? DEVICES[0];
}

export interface Emulation {
  deviceId: DeviceId;
  landscape: boolean;
}

export function deviceSize(emulation: Emulation): { width: number; height: number } {
  const device = findDevice(emulation.deviceId);
  return emulation.landscape
    ? { width: device.height, height: device.width }
    : { width: device.width, height: device.height };
}

const DEVICE_MARGIN = 32;
const DEVICE_LABEL_HEIGHT = 24;
const MIN_DEVICE_SCALE = 0.25;

export function fitDevice(emulation: Emulation, page: Rectangle): DeviceFrame {
  const device = findDevice(emulation.deviceId);
  const { width, height } = deviceSize(emulation);
  const availableWidth = page.width - 2 * DEVICE_MARGIN;
  const availableHeight = page.height - 2 * DEVICE_MARGIN - DEVICE_LABEL_HEIGHT;
  const scale = Math.max(MIN_DEVICE_SCALE, Math.min(1, availableWidth / width, availableHeight / height));
  const viewWidth = Math.round(width * scale);
  const viewHeight = Math.round(height * scale);
  return {
    label: device.label,
    width,
    height,
    scale,
    cornerRadius: device.cornerRadius,
    x: Math.round((page.width - viewWidth) / 2),
    y: DEVICE_LABEL_HEIGHT + Math.round((page.height - DEVICE_LABEL_HEIGHT - viewHeight) / 2),
    viewWidth,
    viewHeight,
  };
}

const PROTOCOL_VERSION = '1.3';

export async function applyDeviceMetrics(contents: WebContents, emulation: Emulation, scale: number): Promise<void> {
  const device = findDevice(emulation.deviceId);
  const { width, height } = deviceSize(emulation);
  const dbg = contents.debugger;
  if (!dbg.isAttached()) dbg.attach(PROTOCOL_VERSION);

  await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: device.deviceScaleFactor,
    mobile: true,
    scale,
    screenOrientation: emulation.landscape
      ? { type: 'landscapePrimary', angle: 90 }
      : { type: 'portraitPrimary', angle: 0 },
  });
}

export async function applyEmulation(contents: WebContents, emulation: Emulation, scale: number): Promise<void> {
  await applyDeviceMetrics(contents, emulation, scale);
  const device = findDevice(emulation.deviceId);
  const dbg = contents.debugger;
  await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await dbg.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  await dbg.sendCommand('Emulation.setUserAgentOverride', {
    userAgent: device.userAgent,
    platform: device.platform,
  });
}

export async function clearEmulation(contents: WebContents): Promise<void> {
  if (contents.isDestroyed() || !contents.debugger.isAttached()) return;
  const dbg = contents.debugger;
  await dbg.sendCommand('Emulation.clearDeviceMetricsOverride');
  await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
  await dbg.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: false });
  await dbg.sendCommand('Emulation.setUserAgentOverride', { userAgent: '' });
}
