import type { AddressSuggestion } from '../shared/types.js';

export interface SuggestionSources {
  /** Open tabs other than the active one. */
  tabs: readonly { id: string; title: string; url: string }[];
  bookmarks: readonly { title: string; url: string }[];
  /** Visits, newest first. */
  history: readonly { title: string; url: string; visitedAt: number }[];
}

export const MAX_SUGGESTIONS = 6;
const KIND_ORDER: Record<AddressSuggestion['kind'], number> = { tab: 0, bookmark: 1, history: 2 };

/** Address without scheme and "www.", as people type it. */
function bareUrl(url: string): string {
  return url.replace(/^[a-z][a-z\d+\-.]*:\/\/(www\.)?/i, '').toLocaleLowerCase('tr');
}

/** How well `term` matches a page: 0 for no match. */
function matchScore(term: string, title: string, url: string): number {
  const address = bareUrl(url);
  const name = title.toLocaleLowerCase('tr');
  if (address.startsWith(term)) return 4;
  if (name.startsWith(term) || name.split(/[\s\-–—|:·,.]+/).some((word) => word.startsWith(term))) return 3;
  if (address.includes(term)) return 2;
  if (name.includes(term)) return 1;
  return 0;
}

interface Candidate extends AddressSuggestion {
  score: number;
  visits: number;
  lastVisit: number;
}

/**
 * Pages matching what was typed in the address bar: open tabs, bookmarks and
 * history, one entry per address, best match first.
 */
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
    // One entry per address: an open tab wins over a bookmark, which wins over history.
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
  const visits = new Map<string, { title: string; count: number; last: number }>();
  for (const visit of sources.history) {
    const seen = visits.get(visit.url);
    if (seen) seen.count++;
    else visits.set(visit.url, { title: visit.title, count: 1, last: visit.visitedAt });
  }
  for (const [url, visit] of visits) {
    const score = matchScore(term, visit.title, url);
    if (score === 0) continue;
    const existing = byUrl.get(url);
    if (existing) {
      existing.visits = visit.count;
      existing.lastVisit = visit.last;
    } else {
      offer({ kind: 'history', title: visit.title, url, score, visits: visit.count, lastVisit: visit.last });
    }
  }

  return [...byUrl.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        b.visits - a.visits ||
        b.lastVisit - a.lastVisit,
    )
    .slice(0, limit)
    .map(({ kind, title, url, tabId }) => (tabId ? { kind, title, url, tabId } : { kind, title, url }));
}
