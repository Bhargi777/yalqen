import fs from 'node:fs';
import path from 'node:path';

/** Permissions a site is asked about and that can be changed per site. */
export type SitePermission = 'camera' | 'microphone' | 'geolocation' | 'notifications';
export type Decision = 'allow' | 'deny';

export const SITE_PERMISSIONS: readonly SitePermission[] = ['camera', 'microphone', 'geolocation', 'notifications'];

export const PERMISSION_LABELS: Record<SitePermission, string> = {
  camera: 'Kamera',
  microphone: 'Mikrofon',
  geolocation: 'Konum',
  notifications: 'Bildirimler',
};

/**
 * Site permissions a Chromium permission request needs, or null for requests
 * the user is never asked about.
 */
export function requestedPermissions(permission: string, mediaTypes: readonly string[] = []): SitePermission[] | null {
  switch (permission) {
    case 'media': {
      const kinds: SitePermission[] = [];
      if (mediaTypes.includes('video')) kinds.push('camera');
      if (mediaTypes.includes('audio')) kinds.push('microphone');
      return kinds.length > 0 ? kinds : null;
    }
    case 'geolocation':
      return ['geolocation'];
    case 'notifications':
      return ['notifications'];
    default:
      return null;
  }
}

/** The origin permissions are kept for: web pages only. */
export function permissionOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** Question shown when `host` asks for `kinds`. */
export function permissionQuestion(host: string, kinds: readonly SitePermission[]): string {
  if (kinds.includes('geolocation')) return `${host} konumunuzu öğrenmek istiyor.`;
  if (kinds.includes('notifications')) return `${host} bildirim göstermek istiyor.`;
  const devices = [kinds.includes('camera') ? 'kameranızı' : null, kinds.includes('microphone') ? 'mikrofonunuzu' : null];
  return `${host} ${devices.filter(Boolean).join(' ve ')} kullanmak istiyor.`;
}

interface SavedPermissions {
  version: 1;
  sites: Record<string, Partial<Record<SitePermission, Decision>>>;
}

/**
 * Per-site decisions. "Allow" and "block" are saved; a one-time grant lasts
 * until the app quits.
 */
export class PermissionStore {
  readonly file: string;
  private readonly sites = new Map<string, Map<SitePermission, Decision>>();
  private readonly once = new Set<string>();

  constructor(directory: string) {
    this.file = path.join(directory, 'permissions.json');
    this.load();
  }

  /** `ask` unless every permission is allowed, or one is blocked. */
  decide(origin: string, kinds: readonly SitePermission[]): Decision | 'ask' {
    const decisions = kinds.map((kind) => this.get(origin, kind) ?? (this.once.has(`${origin} ${kind}`) ? 'allow' : undefined));
    if (decisions.includes('deny')) return 'deny';
    return decisions.every((decision) => decision === 'allow') ? 'allow' : 'ask';
  }

  get(origin: string, kind: SitePermission): Decision | undefined {
    return this.sites.get(origin)?.get(kind);
  }

  /** Saved decisions for a site, in a fixed order. */
  list(origin: string): { kind: SitePermission; decision: Decision }[] {
    const site = this.sites.get(origin);
    return SITE_PERMISSIONS.flatMap((kind) => {
      const decision = site?.get(kind);
      return decision ? [{ kind, decision }] : [];
    });
  }

  /** Saves a decision; null asks again next time. */
  set(origin: string, kinds: readonly SitePermission[], decision: Decision | null): void {
    let site = this.sites.get(origin);
    for (const kind of kinds) {
      this.once.delete(`${origin} ${kind}`);
      if (decision) {
        site ??= new Map();
        this.sites.set(origin, site);
        site.set(kind, decision);
      } else {
        site?.delete(kind);
      }
    }
    if (site?.size === 0) this.sites.delete(origin);
    this.save();
  }

  allowOnce(origin: string, kinds: readonly SitePermission[]): void {
    for (const kind of kinds) this.once.add(`${origin} ${kind}`);
  }

  private load(): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8')) as SavedPermissions;
      if (data.version !== 1 || typeof data.sites !== 'object' || data.sites === null) return;
      for (const [origin, saved] of Object.entries(data.sites)) {
        if (permissionOrigin(origin) !== origin || typeof saved !== 'object' || saved === null) continue;
        const site = new Map<SitePermission, Decision>();
        for (const kind of SITE_PERMISSIONS) {
          const decision = saved[kind];
          if (decision === 'allow' || decision === 'deny') site.set(kind, decision);
        }
        if (site.size > 0) this.sites.set(origin, site);
      }
    } catch {
      // Missing or unreadable: every site is asked again.
    }
  }

  private save(): void {
    const data: SavedPermissions = {
      version: 1,
      sites: Object.fromEntries([...this.sites].map(([origin, site]) => [origin, Object.fromEntries(site)])),
    };
    const temp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(temp, JSON.stringify(data));
      fs.renameSync(temp, this.file);
    } catch (error) {
      console.warn('[permissions] could not save site permissions:', error);
    }
  }
}
