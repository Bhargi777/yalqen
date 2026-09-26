import { randomUUID } from 'node:crypto';
import { INTERNAL_SCHEME } from '../shared/types.js';

/** Address the certificate warning page opens to proceed; ends with a one-time token. */
export const PROCEED_URL = `${INTERNAL_SCHEME}://proceed/`;

function hostOf(url: string): string | null {
  try {
    const { protocol, host } = new URL(url);
    return protocol === 'https:' && host !== '' ? host : null;
  } catch {
    return null;
  }
}

interface Rejected {
  url: string;
  host: string;
  fingerprint: string;
}

/**
 * Certificates the user chose to trust after a warning, per host, for this
 * session only. A warning page can accept only the certificate it was shown for.
 */
export class CertificateExceptions {
  private readonly allowed = new Map<string, string>();
  /** Rejected main-frame certificates by token. */
  private readonly rejected = new Map<string, Rejected>();

  /** Whether the user proceeded to `url`'s host with this certificate. */
  allows(url: string, fingerprint: string): boolean {
    const host = hostOf(url);
    return host !== null && this.allowed.get(host) === fingerprint;
  }

  hasException(url: string): boolean {
    const host = hostOf(url);
    return host !== null && this.allowed.has(host);
  }

  /** Records a certificate rejected for a page; returns the token its warning page uses to proceed. */
  reject(url: string, fingerprint: string): string | null {
    const host = hostOf(url);
    if (!host) return null;
    for (const [token, entry] of this.rejected) {
      if (entry.url === url) this.rejected.delete(token);
    }
    const token = randomUUID();
    this.rejected.set(token, { url, host, fingerprint });
    return token;
  }

  /** The token of the certificate last rejected for `url`. */
  tokenFor(url: string): string | null {
    for (const [token, entry] of this.rejected) {
      if (entry.url === url) return token;
    }
    return null;
  }

  /** Trusts the certificate a warning page for `url` was shown for; false for an unknown token. */
  proceed(token: string, url: string): boolean {
    const entry = this.rejected.get(token);
    if (!entry || entry.url !== url) return false;
    this.rejected.delete(token);
    this.allowed.set(entry.host, entry.fingerprint);
    return true;
  }

  /** Shows warnings for `url`'s host again. */
  revoke(url: string): void {
    const host = hostOf(url);
    if (host) this.allowed.delete(host);
  }
}
