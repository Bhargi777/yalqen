const MAX_NAME = 120;

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

export function canViewSource(url: string): boolean {
  return /^(https?|file):/i.test(url);
}
