import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MenuItemConstructorOptions } from 'electron';
import { BOOKMARKS_URL } from '../shared/types.js';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  /** Null for bookmarks outside any folder. */
  folderId: string | null;
  createdAt: number;
}

export interface BookmarkFolder {
  id: string;
  title: string;
  createdAt: number;
}

interface SavedBookmarks {
  version: 1;
  folders: BookmarkFolder[];
  bookmarks: Bookmark[];
}

const MAX_TITLE = 200;
const MENU_TITLE = 60;

/** Pages that can be bookmarked: web pages and files. */
export function canBookmark(url: string): boolean {
  return /^(https?|file):/i.test(url);
}

function cleanTitle(title: string, fallback: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) || fallback;
}

/** Bookmarks in one level of folders, in the order they were added. */
export class BookmarkStore {
  readonly file: string;
  private folderList: BookmarkFolder[] = [];
  private bookmarkList: Bookmark[] = [];

  constructor(directory: string) {
    this.file = path.join(directory, 'bookmarks.json');
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8')) as SavedBookmarks;
      if (data.version !== 1) return;
      this.folderList = (Array.isArray(data.folders) ? data.folders : []).filter(
        (folder) => typeof folder?.id === 'string' && typeof folder.title === 'string' && Number.isFinite(folder.createdAt),
      );
      const folderIds = new Set(this.folderList.map((folder) => folder.id));
      this.bookmarkList = (Array.isArray(data.bookmarks) ? data.bookmarks : [])
        .filter(
          (bookmark) =>
            typeof bookmark?.id === 'string' && typeof bookmark.title === 'string' &&
            typeof bookmark.url === 'string' && canBookmark(bookmark.url) && Number.isFinite(bookmark.createdAt),
        )
        .map((bookmark) => ({ ...bookmark, folderId: folderIds.has(bookmark.folderId ?? '') ? bookmark.folderId : null }));
    } catch {
      // No bookmarks yet, or a damaged file.
    }
  }

  folders(): BookmarkFolder[] {
    return this.folderList.map((folder) => ({ ...folder }));
  }

  /** Bookmarks, optionally only those whose title or address contains `query`. */
  bookmarks(query = ''): Bookmark[] {
    const term = query.trim().toLocaleLowerCase('tr').slice(0, 200);
    return this.bookmarkList
      .filter((bookmark) => !term || `${bookmark.title} ${bookmark.url}`.toLocaleLowerCase('tr').includes(term))
      .map((bookmark) => ({ ...bookmark }));
  }

  find(url: string): Bookmark | undefined {
    const bookmark = this.bookmarkList.find((item) => item.url === url);
    return bookmark && { ...bookmark };
  }

  add(url: string, title: string): Bookmark | null {
    if (!canBookmark(url)) return null;
    const existing = this.find(url);
    if (existing) return existing;
    const bookmark: Bookmark = { id: randomUUID(), title: cleanTitle(title, url), url, folderId: null, createdAt: Date.now() };
    this.bookmarkList.push(bookmark);
    this.save();
    return { ...bookmark };
  }

  remove(id: string): void {
    const before = this.bookmarkList.length;
    this.bookmarkList = this.bookmarkList.filter((bookmark) => bookmark.id !== id);
    if (this.bookmarkList.length !== before) this.save();
  }

  rename(id: string, title: string): void {
    const bookmark = this.bookmarkList.find((item) => item.id === id);
    if (!bookmark) return;
    bookmark.title = cleanTitle(title, bookmark.url);
    this.save();
  }

  /** Moves a bookmark into a folder, or out of folders with null or an unknown id. */
  move(id: string, folderId: string | null): void {
    const bookmark = this.bookmarkList.find((item) => item.id === id);
    if (!bookmark) return;
    bookmark.folderId = this.folderList.some((folder) => folder.id === folderId) ? folderId : null;
    this.save();
  }

  addFolder(title: string): BookmarkFolder {
    const folder: BookmarkFolder = { id: randomUUID(), title: cleanTitle(title, 'Yeni klasör'), createdAt: Date.now() };
    this.folderList.push(folder);
    this.save();
    return { ...folder };
  }

  renameFolder(id: string, title: string): void {
    const folder = this.folderList.find((item) => item.id === id);
    if (!folder) return;
    folder.title = cleanTitle(title, folder.title);
    this.save();
  }

  /** Deletes a folder; its bookmarks move out of it. */
  removeFolder(id: string): void {
    const before = this.folderList.length;
    this.folderList = this.folderList.filter((folder) => folder.id !== id);
    if (this.folderList.length === before) return;
    for (const bookmark of this.bookmarkList) {
      if (bookmark.folderId === id) bookmark.folderId = null;
    }
    this.save();
  }

  private save(): void {
    const data: SavedBookmarks = { version: 1, folders: this.folderList, bookmarks: this.bookmarkList };
    const temp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(temp, JSON.stringify(data));
      fs.renameSync(temp, this.file);
    } catch (error) {
      console.warn('[bookmarks] could not save bookmarks:', error);
    }
  }
}

function menuTitle(title: string): string {
  return title.length > MENU_TITLE ? `${title.slice(0, MENU_TITLE - 1)}…` : title;
}

export interface BookmarksMenuActions {
  open(url: string): void;
  showAll(): void;
}

/** Menu of the toolbar's bookmarks button: folders first, then loose bookmarks. */
export function bookmarksMenuTemplate(
  folders: readonly BookmarkFolder[],
  bookmarks: readonly Bookmark[],
  actions: BookmarksMenuActions,
): MenuItemConstructorOptions[] {
  const item = (bookmark: Bookmark): MenuItemConstructorOptions => ({
    label: menuTitle(bookmark.title),
    click: () => actions.open(bookmark.url),
  });
  const inFolders = folders.map((folder): MenuItemConstructorOptions => {
    const children = bookmarks.filter((bookmark) => bookmark.folderId === folder.id);
    return {
      label: menuTitle(folder.title),
      submenu: children.length > 0 ? children.map(item) : [{ label: 'Boş', enabled: false }],
    };
  });
  const loose = bookmarks.filter((bookmark) => bookmark.folderId === null).map(item);
  const entries = [...inFolders, ...loose];
  return [
    ...(entries.length > 0 ? entries : [{ label: 'Henüz yer imi yok', enabled: false }]),
    { type: 'separator' },
    { label: 'Tüm yer imleri', click: actions.showAll },
  ];
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

/** Content of the bookmarks page. Its forms and links are commands the tab handles. */
export function renderBookmarks(folders: readonly BookmarkFolder[], bookmarks: readonly Bookmark[], query: string): string {
  const search = query.trim().slice(0, 200);
  const header =
    `<form class="search" action="${BOOKMARKS_URL}" method="get"><input name="q" type="search" placeholder="Yer imlerinde ara" aria-label="Yer imlerinde ara" value="${escapeHtml(search)}" /></form>` +
    (search ? '' : `<form class="new-folder" action="${BOOKMARKS_URL}new-folder" method="get"><input name="title" placeholder="Yeni klasör adı" aria-label="Yeni klasör adı" required /><button>Klasör ekle</button></form>`);

  const folderOptions = (current: string | null) =>
    [`<option value=""${current === null ? ' selected' : ''}>Klasör yok</option>`,
      ...folders.map((folder) => `<option value="${escapeHtml(folder.id)}"${folder.id === current ? ' selected' : ''}>${escapeHtml(folder.title)}</option>`)].join('');

  const row = (bookmark: Bookmark) => {
    const id = escapeHtml(bookmark.id);
    return (
      `<li><a class="visit" href="${escapeHtml(bookmark.url)}"><strong>${escapeHtml(bookmark.title)}</strong><span>${escapeHtml(hostOf(bookmark.url))}</span></a>` +
      `<details><summary>Düzenle</summary>` +
      `<form action="${BOOKMARKS_URL}rename" method="get"><input type="hidden" name="id" value="${id}" /><input name="title" value="${escapeHtml(bookmark.title)}" aria-label="Ad" required /><button>Kaydet</button></form>` +
      (folders.length > 0
        ? `<form action="${BOOKMARKS_URL}move" method="get"><input type="hidden" name="id" value="${id}" /><select name="folder" aria-label="Klasör">${folderOptions(bookmark.folderId)}</select><button>Taşı</button></form>`
        : '') +
      `<a class="danger" href="${BOOKMARKS_URL}remove?id=${encodeURIComponent(bookmark.id)}">Sil</a></details></li>`
    );
  };

  if (search) {
    return bookmarks.length === 0
      ? `${header}<p class="empty">Eşleşen yer imi bulunamadı.</p>`
      : `${header}<ol>${bookmarks.map(row).join('')}</ol>`;
  }
  if (bookmarks.length === 0 && folders.length === 0) {
    return `${header}<p class="empty">Henüz yer imi yok. Bir sayfayı eklemek için adres çubuğundaki yıldıza bas veya ⌘D kullan.</p>`;
  }
  const sections = folders.map((folder) => {
    const children = bookmarks.filter((bookmark) => bookmark.folderId === folder.id);
    return (
      `<section><div class="folder"><h2>${escapeHtml(folder.title)}</h2><details><summary>Düzenle</summary>` +
      `<form action="${BOOKMARKS_URL}rename-folder" method="get"><input type="hidden" name="id" value="${escapeHtml(folder.id)}" /><input name="title" value="${escapeHtml(folder.title)}" aria-label="Klasör adı" required /><button>Kaydet</button></form>` +
      `<a class="danger" href="${BOOKMARKS_URL}remove-folder?id=${encodeURIComponent(folder.id)}">Klasörü sil</a></details></div>` +
      (children.length > 0 ? `<ol>${children.map(row).join('')}</ol>` : '<p class="empty-folder">Bu klasör boş.</p>') +
      '</section>'
    );
  });
  const loose = bookmarks.filter((bookmark) => bookmark.folderId === null);
  const looseSection = loose.length > 0 ? `<section><ol>${loose.map(row).join('')}</ol></section>` : '';
  return `${header}${sections.join('')}${looseSection}`;
}
