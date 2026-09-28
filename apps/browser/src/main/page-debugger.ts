import type { WebContents } from 'electron';
import { fullPageClip } from './page-export.js';

const PROTOCOL_VERSION = '1.3';

export function attachDebugger(contents: WebContents): void {
  if (!contents.debugger.isAttached()) contents.debugger.attach(PROTOCOL_VERSION);
}

export async function setCacheDisabled(contents: WebContents, disabled: boolean): Promise<void> {
  const dbg = contents.debugger;
  if (disabled) {
    attachDebugger(contents);
    // Only the cache switch is needed, so the protocol keeps no response bodies around.
    await dbg.sendCommand('Network.enable', { maxTotalBufferSize: 0, maxResourceBufferSize: 0 });
    await dbg.sendCommand('Network.setCacheDisabled', { cacheDisabled: true });
    return;
  }
  if (!dbg.isAttached()) return;
  await dbg.sendCommand('Network.setCacheDisabled', { cacheDisabled: false });
  await dbg.sendCommand('Network.disable');
}

export async function captureFullPage(contents: WebContents): Promise<Buffer> {
  attachDebugger(contents);
  const dbg = contents.debugger;
  const metrics = (await dbg.sendCommand('Page.getLayoutMetrics')) as {
    cssContentSize: { width: number; height: number };
  };
  const pixelRatio = Number(await contents.executeJavaScript('window.devicePixelRatio')) || 1;
  const { data } = (await dbg.sendCommand('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: fullPageClip(metrics.cssContentSize, pixelRatio),
  })) as { data: string };
  return Buffer.from(data, 'base64');
}
