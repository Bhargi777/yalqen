import { buildSearchUrl, type SearchEngine } from './search.js';

const EXPLICIT_SCHEMES = new Set(['http:', 'https:', 'file:', 'about:', 'data:', 'view-source:', 'yalqen:']);

export function resolveInput(input: string, engine: SearchEngine): string {
  const text = input.trim();
  if (text === '') return 'about:blank';

  if (/^[a-z][a-z\d+\-.]*:/i.test(text) && !/\s/.test(text)) {
    try {
      const url = new URL(text);
      if (EXPLICIT_SCHEMES.has(url.protocol)) return url.toString();
    } catch {
    }
  }

  const looksLikeHost =
    !/\s/.test(text) && (/^localhost(:\d+)?(\/|$)/i.test(text) || /^[^/]+\.[^/]+/.test(text));
  if (looksLikeHost) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(text);
    try {
      return new URL(`${isLocal ? 'http' : 'https'}://${text}`).toString();
    } catch {
    }
  }

  return buildSearchUrl(engine, text);
}
