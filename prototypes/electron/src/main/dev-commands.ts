import {
  AUTO_RELOAD_SECONDS,
  type AddressSuggestion,
  type AutoReloadSeconds,
  type DevCommandId,
} from '../shared/types.js';

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
