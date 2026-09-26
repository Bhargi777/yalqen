const MAX_NAME = 120;

/** A file name for saving a page as PDF, from its title or else its address. */
export function pdfFileName(title: string, url: string): string {
  let name = title.trim();
  if (name === '' || name === url) {
    try {
      name = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      name = '';
    }
  }
  const safe = name
    .replace(/[\u0000-\u001f\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, MAX_NAME)
    .trim();
  return `${safe || 'sayfa'}.pdf`;
}

/** Pages whose source can be shown; the source view itself and internal pages cannot. */
export function canViewSource(url: string): boolean {
  return /^(https?|file):/i.test(url);
}
