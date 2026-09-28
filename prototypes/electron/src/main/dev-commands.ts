import type { AddressSuggestion, DevCommandId } from '../shared/types.js';

export const DEV_COMMAND_PREFIX = '>';

interface DevCommand {
  id: DevCommandId;
  title: string;
  shortcut?: string;
  keywords: string;
}

export const DEV_COMMANDS: readonly DevCommand[] = [
  { id: 'hard-reload', title: 'Önbelleği yok sayarak yenile', shortcut: '⇧⌘R', keywords: 'hard reload cache' },
  { id: 'devtools', title: 'Geliştirici araçlarını aç/kapat', shortcut: '⌥⌘I', keywords: 'devtools inspect console konsol' },
  { id: 'view-source', title: 'Sayfa kaynağını görüntüle', shortcut: '⌥⌘U', keywords: 'view source html kaynak' },
  { id: 'device', title: 'Telefon görünümünü aç/kapat', shortcut: '⌥⌘M', keywords: 'device mobile responsive cihaz mobil' },
  { id: 'rotate-device', title: 'Cihazı döndür', shortcut: '⇧⌥⌘M', keywords: 'rotate landscape portrait yatay dikey' },
  { id: 'clear-cache', title: 'Önbelleği temizle ve yenile', keywords: 'clear cache empty' },
  { id: 'clear-site-data', title: 'Bu sitenin verilerini temizle', keywords: 'clear site data cookies storage çerez depolama localstorage' },
];

export function isDevCommandInput(input: string): boolean {
  return input.trimStart().startsWith(DEV_COMMAND_PREFIX);
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
