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
