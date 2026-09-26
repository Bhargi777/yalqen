import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron';

const SNIPPET_LENGTH = 30;

export type PageContext = Pick<
  ContextMenuParams,
  | 'linkURL'
  | 'srcURL'
  | 'mediaType'
  | 'selectionText'
  | 'isEditable'
  | 'editFlags'
  | 'misspelledWord'
  | 'dictionarySuggestions'
>;

const MAX_SPELLING_SUGGESTIONS = 5;

export interface ContextMenuActions {
  canGoBack: boolean;
  canGoForward: boolean;
  /** The page's source can be shown; false for the source view and internal pages. */
  canViewSource: boolean;
  openInNewTab(url: string): void;
  openInNewWindow(url: string): void;
  copyText(text: string): void;
  copyImage(): void;
  download(url: string): void;
  search(text: string): void;
  goBack(): void;
  goForward(): void;
  reload(): void;
  inspect(): void;
  print(): void;
  viewSource(): void;
  replaceMisspelling(word: string): void;
  addToDictionary(word: string): void;
}

/** Selected text shortened to one line for a menu label. */
export function snippet(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > SNIPPET_LENGTH ? `${line.slice(0, SNIPPET_LENGTH - 1)}…` : line;
}

/**
 * Links and images the menu offers to open. A page must not reach local files or
 * the browser's own pages this way, and scripts or HTML documents in the address are left out.
 */
function canOpen(url: string): boolean {
  return /^https?:/i.test(url) || (/^data:/i.test(url) && !/^data:text\/html/i.test(url));
}

/** Items for a right click on a page, grouped by what was clicked. */
export function contextMenuTemplate(context: PageContext, actions: ContextMenuActions): MenuItemConstructorOptions[] {
  const groups: MenuItemConstructorOptions[][] = [];
  const link = context.linkURL;
  const image = context.mediaType === 'image' ? context.srcURL : '';
  const selection = context.selectionText.trim();

  if (link) {
    groups.push([
      ...(canOpen(link)
        ? [
            { label: 'Bağlantıyı yeni sekmede aç', click: () => actions.openInNewTab(link) },
            { label: 'Bağlantıyı yeni pencerede aç', click: () => actions.openInNewWindow(link) },
            { label: 'Bağlantıyı indir', click: () => actions.download(link) },
          ]
        : []),
      { label: 'Bağlantı adresini kopyala', click: () => actions.copyText(link) },
    ]);
  }
  if (image) {
    groups.push([
      ...(canOpen(image)
        ? [
            { label: 'Resmi yeni sekmede aç', click: () => actions.openInNewTab(image) },
            { label: 'Resmi indir', click: () => actions.download(image) },
          ]
        : []),
      { label: 'Resmi kopyala', click: actions.copyImage },
      { label: 'Resim adresini kopyala', click: () => actions.copyText(image) },
    ]);
  }
  if (context.isEditable && context.misspelledWord) {
    const word = context.misspelledWord;
    const suggestions = context.dictionarySuggestions.slice(0, MAX_SPELLING_SUGGESTIONS);
    groups.push([
      ...(suggestions.length > 0
        ? suggestions.map((suggestion) => ({ label: suggestion, click: () => actions.replaceMisspelling(suggestion) }))
        : [{ label: 'Yazım önerisi yok', enabled: false }]),
      { label: `“${snippet(word)}” sözlüğe ekle`, click: () => actions.addToDictionary(word) },
    ]);
  }
  if (context.isEditable) {
    const flags = context.editFlags;
    groups.push(
      [
        { label: 'Geri al', role: 'undo', enabled: flags.canUndo },
        { label: 'Yinele', role: 'redo', enabled: flags.canRedo },
      ],
      [
        { label: 'Kes', role: 'cut', enabled: flags.canCut },
        { label: 'Kopyala', role: 'copy', enabled: flags.canCopy },
        { label: 'Yapıştır', role: 'paste', enabled: flags.canPaste },
        { label: 'Tümünü seç', role: 'selectAll', enabled: flags.canSelectAll },
      ],
    );
  } else if (selection) {
    groups.push([{ label: 'Kopyala', role: 'copy' }]);
  }
  if (selection) {
    groups.push([{ label: `“${snippet(selection)}” için ara`, click: () => actions.search(selection) }]);
  }
  if (groups.length === 0) {
    groups.push([
      { label: 'Geri', enabled: actions.canGoBack, click: actions.goBack },
      { label: 'İleri', enabled: actions.canGoForward, click: actions.goForward },
      { label: 'Yenile', click: actions.reload },
    ]);
    groups.push([
      { label: 'Yazdır…', click: actions.print },
      ...(actions.canViewSource ? [{ label: 'Sayfa kaynağını görüntüle', click: actions.viewSource }] : []),
    ]);
  }
  groups.push([{ label: 'İncele', click: actions.inspect }]);

  return groups.flatMap((group, index) => (index === 0 ? group : [{ type: 'separator' as const }, ...group]));
}
