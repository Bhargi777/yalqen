const SEARCH_URL = 'https://duckduckgo.com/?q=';

/** Turns address bar input into a URL: explicit URLs, bare hosts, or a search. */
export function resolveInput(input: string): string {
  const text = input.trim();
  if (text === '') return 'about:blank';

  if (/^[a-z][a-z\d+\-.]*:/i.test(text) && !/\s/.test(text)) {
    try {
      return new URL(text).toString();
    } catch {
      // Fall through to host or search handling.
    }
  }

  const looksLikeHost =
    !/\s/.test(text) && (/^localhost(:\d+)?(\/|$)/i.test(text) || /^[^/]+\.[^/]+/.test(text));
  if (looksLikeHost) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(text);
    try {
      return new URL(`${isLocal ? 'http' : 'https'}://${text}`).toString();
    } catch {
      // Fall through to search.
    }
  }

  return SEARCH_URL + encodeURIComponent(text);
}
