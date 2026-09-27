import { displayHost } from '../shared/hosts.js';
import type { AddressSuggestion } from '../shared/types.js';

export interface Visit {
  title: string;
  url: string;
  visitedAt: number;
  faviconUrl?: string;
}

interface IndexedPage {
  url: string;
  title: string;
  address: string;
  name: string;
  words: string[];
  visits: number;
  lastVisit: number;
}

export interface HistoryIndex {
  pages: readonly IndexedPage[];
  favicons: ReadonlyMap<string, string>;
}

export interface SuggestionSources {
  tabs: readonly { id: string; title: string; url: string }[];
  bookmarks: readonly { title: string; url: string }[];
  history: HistoryIndex;
}

export const EMPTY_HISTORY_INDEX: HistoryIndex = { pages: [], favicons: new Map() };

export const MAX_SUGGESTIONS = 6;
const KIND_ORDER: Record<AddressSuggestion['kind'], number> = { tab: 0, bookmark: 1, history: 2 };


function bareUrl(url: string): string {
  return url.replace(/^[a-z][a-z\d+\-.]*:\/\/(www\.)?/i, '').toLocaleLowerCase('tr');
}

function wordsOf(name: string): string[] {
  return name.split(/[\s\-–—|:·,.]+/);
}

function matchText(term: string, address: string, name: string, words: readonly string[]): number {
  if (address.startsWith(term)) return 4;
  if (name.startsWith(term) || words.some((word) => word.startsWith(term))) return 3;
  if (address.includes(term)) return 2;
  if (name.includes(term)) return 1;
  return 0;
}

function matchScore(term: string, title: string, url: string): number {
  const name = title.toLocaleLowerCase('tr');
  return matchText(term, bareUrl(url), name, wordsOf(name));
}

export function indexHistory(history: readonly Visit[]): HistoryIndex {
  const pages = new Map<string, IndexedPage>();
  const favicons = new Map<string, string>();
  for (const visit of history) {
    const seen = pages.get(visit.url);
    if (seen) {
      seen.visits++;
    } else {
      const name = visit.title.toLocaleLowerCase('tr');
      pages.set(visit.url, {
        url: visit.url,
        title: visit.title,
        address: bareUrl(visit.url),
        name,
        words: wordsOf(name),
        visits: 1,
        lastVisit: visit.visitedAt,
      });
    }
    if (!visit.faviconUrl) continue;
    const host = displayHost(visit.url);
    if (host && !favicons.has(host)) favicons.set(host, visit.faviconUrl);
  }
  return { pages: [...pages.values()], favicons };
}

interface Candidate extends AddressSuggestion {
  score: number;
  visits: number;
  lastVisit: number;
}

export function suggest(input: string, sources: SuggestionSources, limit = MAX_SUGGESTIONS): AddressSuggestion[] {
  const term = input.trim().toLocaleLowerCase('tr').slice(0, 200);
  if (term === '') return [];
  const byUrl = new Map<string, Candidate>();
  const offer = (candidate: Candidate) => {
    const existing = byUrl.get(candidate.url);
    if (!existing) {
      byUrl.set(candidate.url, candidate);
      return;
    }
    if (KIND_ORDER[candidate.kind] < KIND_ORDER[existing.kind]) {
      byUrl.set(candidate.url, { ...candidate, visits: existing.visits, lastVisit: existing.lastVisit });
    }
  };

  for (const tab of sources.tabs) {
    const score = matchScore(term, tab.title, tab.url);
    if (score > 0) offer({ kind: 'tab', title: tab.title, url: tab.url, tabId: tab.id, score, visits: 0, lastVisit: 0 });
  }
  for (const bookmark of sources.bookmarks) {
    const score = matchScore(term, bookmark.title, bookmark.url);
    if (score > 0) offer({ kind: 'bookmark', title: bookmark.title, url: bookmark.url, score, visits: 0, lastVisit: 0 });
  }
  for (const page of sources.history.pages) {
    const score = matchText(term, page.address, page.name, page.words);
    if (score === 0) continue;
    const existing = byUrl.get(page.url);
    if (existing) {
      existing.visits = page.visits;
      existing.lastVisit = page.lastVisit;
    } else {
      offer({ kind: 'history', title: page.title, url: page.url, score, visits: page.visits, lastVisit: page.lastVisit });
    }
  }

  const { favicons } = sources.history;
  return [...byUrl.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        b.visits - a.visits ||
        b.lastVisit - a.lastVisit,
    )
    .slice(0, limit)
    .map(({ kind, title, url, tabId }) => {
      const suggestion: AddressSuggestion = tabId ? { kind, title, url, tabId } : { kind, title, url };
      const faviconUrl = favicons.get(displayHost(url));
      if (faviconUrl) suggestion.faviconUrl = faviconUrl;
      return suggestion;
    });
}
