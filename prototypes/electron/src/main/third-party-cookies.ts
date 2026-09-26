import type { Session } from 'electron';
import { getDomain } from 'tldts';

export function siteOf(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(protocol) || hostname === '') return null;
    return getDomain(hostname) ?? hostname;
  } catch {
    return null;
  }
}

export function isThirdParty(requestUrl: string, pageUrl: string): boolean {
  const request = siteOf(requestUrl);
  return request !== null && request !== siteOf(pageUrl);
}

export function headerValues(headers: Record<string, string | string[]> | undefined, name: string): string[] {
  const values: string[] = [];
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === name) values.push(...(Array.isArray(value) ? value : [value]));
  }
  return values;
}

export function requestCookieNames(header: string): string[] {
  return header
    .split(';')
    .map((pair) => pair.split('=')[0].trim())
    .filter(Boolean);
}

export function responseCookieNames(setCookies: readonly string[]): string[] {
  return setCookies.map((cookie) => cookie.split(';')[0].split('=')[0].trim()).filter(Boolean);
}

export function blockThirdPartyCookies(session: Session, enabled: () => boolean): void {
  const existing = new Map<number, Set<string>>();
  const pageOf = (details: { webContents?: Electron.WebContents | null }) => {
    const contents = details.webContents;
    return contents && !contents.isDestroyed() ? contents.getURL() : '';
  };

  session.webRequest.onBeforeSendHeaders((details, callback) => {
    const page = pageOf(details);
    if (!enabled() || details.resourceType === 'mainFrame' || !page || !isThirdParty(details.url, page)) {
      callback({});
      return;
    }
    const requestHeaders = { ...details.requestHeaders };
    const sent = new Set<string>();
    for (const key of Object.keys(requestHeaders)) {
      if (key.toLowerCase() !== 'cookie') continue;
      for (const name of requestCookieNames(requestHeaders[key])) sent.add(name);
      delete requestHeaders[key];
    }
    existing.set(details.id, sent);
    callback({ requestHeaders });
  });
  session.webRequest.onCompleted((details) => {
    const sent = existing.get(details.id);
    existing.delete(details.id);
    if (!sent) return;
    for (const name of responseCookieNames(headerValues(details.responseHeaders, 'set-cookie'))) {
      if (!sent.has(name)) void session.cookies.remove(details.url, name);
    }
  });
  session.webRequest.onErrorOccurred((details) => existing.delete(details.id));
}
