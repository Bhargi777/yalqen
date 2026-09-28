import {
  AUTO_RELOAD_SECONDS,
  NETWORK_PRESETS,
  USER_AGENT_PRESETS,
  type AddressSuggestion,
  type AutoReloadSeconds,
  type DevCommandId,
  type PageOverrides,
} from '../shared/types.js';
import { NETWORK_CONDITIONS, NO_OVERRIDES, USER_AGENTS } from './page-overrides.js';

export const DEV_COMMAND_PREFIX = '>';

interface DevCommand {
  id: DevCommandId;
  title: string;
  shortcut?: string;
  keywords: string;
}

function autoReloadLabel(seconds: AutoReloadSeconds): string {
  return seconds < 60 ? `${seconds} sn` : `${seconds / 60} dk`;
}

export const DEV_COMMANDS: readonly DevCommand[] = [
  { id: 'hard-reload', title: 'Önbelleği yok sayarak yenile', shortcut: '⇧⌘R', keywords: 'hard reload cache' },
  {
    id: 'toggle-cache',
    title: 'Bu sekmede önbelleği kapat/aç',
    keywords: 'disable cache no-cache önbellek devre dışı',
  },
  ...AUTO_RELOAD_SECONDS.map((seconds): DevCommand => ({
    id: `auto-reload-${seconds}`,
    title: `Otomatik yenile: ${autoReloadLabel(seconds)}`,
    keywords: 'auto reload refresh interval yenileme',
  })),
  { id: 'auto-reload-off', title: 'Otomatik yenilemeyi durdur', keywords: 'auto reload refresh stop kapat' },
  ...NETWORK_PRESETS.map((preset): DevCommand => ({
    id: `network-${preset}`,
    title: `Ağ: ${NETWORK_CONDITIONS[preset].label}`,
    keywords: 'network throttle offline slow ağ kısıtla bağlantı',
  })),
  { id: 'network-online', title: 'Ağ kısıtlamasını kaldır', keywords: 'network throttle online ağ kısıtla' },
  { id: 'color-scheme-dark', title: 'Koyu temayı taklit et', keywords: 'dark mode prefers-color-scheme tema' },
  { id: 'color-scheme-light', title: 'Açık temayı taklit et', keywords: 'light mode prefers-color-scheme tema' },
  { id: 'color-scheme-auto', title: 'Sistem temasına dön', keywords: 'color scheme reset prefers-color-scheme tema' },
  {
    id: 'toggle-reduced-motion',
    title: 'Azaltılmış hareketi taklit et/kapat',
    keywords: 'prefers-reduced-motion animation animasyon',
  },
  { id: 'toggle-print-media', title: 'Yazdırma görünümünü aç/kapat', keywords: 'print media css yazdır' },
  ...USER_AGENT_PRESETS.map((preset): DevCommand => ({
    id: `user-agent-${preset}`,
    title: `User-Agent: ${USER_AGENTS[preset].label}`,
    keywords: 'user agent ua tarayıcı browser',
  })),
  { id: 'user-agent-default', title: "User-Agent'ı varsayılana döndür", keywords: 'user agent ua reset' },
  {
    id: 'developer-window',
    title: 'Yeni geliştirici penceresi',
    keywords: 'developer profile window clean session temiz oturum profil',
  },
  {
    id: 'toggle-request-rules',
    title: 'Bu sekmede istek kurallarını uygula/kaldır',
    keywords: 'request rules mock block redirect header intercept istek kural',
  },
  {
    id: 'edit-request-rules',
    title: 'İstek kurallarını düzenle',
    keywords: 'request rules mock block redirect header istek kural ayar',
  },
  {
    id: 'reset-overrides',
    title: 'Tüm sayfa taklitlerini sıfırla',
    keywords: 'reset overrides emulation network media user agent cache sıfırla',
  },
  {
    id: 'devtools',
    title: 'Geliştirici araçlarını aç/kapat',
    shortcut: '⌥⌘I',
    keywords: 'devtools inspect console konsol',
  },
  { id: 'view-source', title: 'Sayfa kaynağını görüntüle', shortcut: '⌥⌘U', keywords: 'view source html kaynak' },
  { id: 'device', title: 'Telefon görünümünü aç/kapat', shortcut: '⌥⌘M', keywords: 'device mobile cihaz mobil' },
  { id: 'responsive', title: 'Duyarlı tasarım modu', keywords: 'responsive breakpoint viewport boyut genişlik' },
  { id: 'rotate-device', title: 'Cihazı döndür', shortcut: '⇧⌥⌘M', keywords: 'rotate landscape portrait yatay dikey' },
  { id: 'screenshot', title: 'Görünür alanın ekran görüntüsünü al', keywords: 'screenshot capture png görüntü' },
  {
    id: 'full-page-screenshot',
    title: 'Tam sayfa ekran görüntüsü al',
    keywords: 'screenshot full page capture png görüntü',
  },
  { id: 'copy-address', title: 'Adresi kopyala', keywords: 'copy url link bağlantı' },
  { id: 'copy-markdown', title: 'Adresi Markdown bağlantısı olarak kopyala', keywords: 'copy markdown link md' },
  { id: 'copy-curl', title: 'Adresi curl komutu olarak kopyala', keywords: 'copy curl terminal shell' },
  { id: 'clear-cache', title: 'Önbelleği temizle ve yenile', keywords: 'clear cache empty' },
  {
    id: 'clear-site-data',
    title: 'Bu sitenin verilerini temizle',
    keywords: 'clear site data cookies storage çerez depolama localstorage',
  },
];

export function isDevCommandInput(input: string): boolean {
  return input.trimStart().startsWith(DEV_COMMAND_PREFIX);
}

export function autoReloadSeconds(id: DevCommandId): AutoReloadSeconds | null {
  return AUTO_RELOAD_SECONDS.find((seconds) => id === `auto-reload-${seconds}`) ?? null;
}

export function overridePatch(id: DevCommandId, current: PageOverrides): Partial<PageOverrides> | null {
  const network = NETWORK_PRESETS.find((preset) => id === `network-${preset}`);
  if (network) return { network };
  const userAgent = USER_AGENT_PRESETS.find((preset) => id === `user-agent-${preset}`);
  if (userAgent) return { userAgent };
  switch (id) {
    case 'toggle-cache':
      return { cacheDisabled: !current.cacheDisabled };
    case 'network-online':
      return { network: null };
    case 'color-scheme-dark':
      return { colorScheme: 'dark' };
    case 'color-scheme-light':
      return { colorScheme: 'light' };
    case 'color-scheme-auto':
      return { colorScheme: null };
    case 'toggle-reduced-motion':
      return { reducedMotion: !current.reducedMotion };
    case 'toggle-print-media':
      return { printMedia: !current.printMedia };
    case 'user-agent-default':
      return { userAgent: null };
    case 'toggle-request-rules':
      return { requestRules: !current.requestRules };
    case 'reset-overrides':
      return NO_OVERRIDES;
    default:
      return null;
  }
}

export function isDevCommandId(value: unknown): value is DevCommandId {
  return DEV_COMMANDS.some((command) => command.id === value);
}

export function matchDevCommands(input: string): AddressSuggestion[] {
  const terms = input.trimStart().slice(DEV_COMMAND_PREFIX.length).toLocaleLowerCase('tr').split(/\s+/).filter(Boolean);
  return DEV_COMMANDS.filter((command) => {
    const text = `${command.title} ${command.keywords}`.toLocaleLowerCase('tr');
    return terms.every((term) => text.includes(term));
  }).map((command) => ({
    kind: 'command',
    title: command.title,
    url: `${DEV_COMMAND_PREFIX}${command.id}`,
    commandId: command.id,
    ...(command.shortcut ? { hint: command.shortcut } : {}),
  }));
}
