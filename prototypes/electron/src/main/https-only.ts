import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { INTERNAL_SCHEME, type SecureDnsSetting } from '../shared/types.js';

/** Address the HTTPS-only warning page opens to continue over http; ends with a one-time token. */
export const PROCEED_HTTP_URL = `${INTERNAL_SCHEME}://proceed-http/`;

/** DNS-over-HTTPS templates of the providers people can pick. */
export const SECURE_DNS_SERVERS: Record<Exclude<SecureDnsSetting, 'off' | 'automatic'>, string> = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google: 'https://dns.google/dns-query{?dns}',
  quad9: 'https://dns.quad9.net/dns-query',
};

/** Host resolver options for a secure DNS setting. */
export function hostResolverOptions(setting: SecureDnsSetting): {
  secureDnsMode: 'off' | 'automatic' | 'secure';
  secureDnsServers?: string[];
} {
  if (setting === 'off' || setting === 'automatic') return { secureDnsMode: setting };
  return { secureDnsMode: 'secure', secureDnsServers: [SECURE_DNS_SERVERS[setting]] };
}

/**
 * The https version of an http address, or null when it is not upgraded: local
 * names and IP addresses, which rarely have certificates, keep http.
 */
export function httpsUpgrade(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:') return null;
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) || !host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return null;
  }
  parsed.protocol = 'https:';
  // Port 80 is http's default; the https default takes its place.
  if (parsed.port === '80') parsed.port = '';
  return parsed.toString();
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * HTTPS-only mode: http pages are loaded over https, and a page that fails
 * that way needs the person's consent to continue over http. Consent lasts
 * for the host until the app quits.
 */
export class HttpsOnly {
  private readonly allowed = new Set<string>();
  /** Warning pages by token: the https address that failed and the http one to fall back to. */
  private readonly warnings = new Map<string, { https: string; http: string }>();

  constructor(private readonly enabled: () => boolean) {}

  /** The address to load instead of `url`, or null to load it as is. */
  upgrade(url: string): string | null {
    if (!this.enabled() || this.allowed.has(hostOf(url))) return null;
    return httpsUpgrade(url);
  }

  /** Records a failed upgrade; returns the token its warning page uses to continue over http. */
  warn(https: string, http: string): string {
    for (const [token, warning] of this.warnings) {
      if (warning.https === https) this.warnings.delete(token);
    }
    const token = randomUUID();
    this.warnings.set(token, { https, http });
    return token;
  }

  /** Allows the host of the warning shown at `currentUrl`; returns the http address to load. */
  proceed(token: string, currentUrl: string): string | null {
    const warning = this.warnings.get(token);
    if (!warning || warning.https !== currentUrl) return null;
    this.warnings.delete(token);
    this.allowHost(warning.http);
    return warning.http;
  }

  /** Lets `url`'s host load over http, as after the person agreed to a redirect. */
  allowHost(url: string): void {
    const host = hostOf(url);
    if (host) this.allowed.add(host);
  }
}
