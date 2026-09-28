export function hostOf(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

export function displayHost(url: string): string {
  return hostOf(url)?.replace(/^www\./, '') ?? url;
}

export function isDevelopmentHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    host === 'localhost' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    /^127(\.\d{1,3}){3}$/.test(host) ||
    ['.localhost', '.test', '.local'].some((suffix) => host.endsWith(suffix))
  );
}
