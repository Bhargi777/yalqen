import { NEW_TAB_URL, type TabSnapshot } from '../shared/types';

export function isNewTab(url: string): boolean {
  return url === NEW_TAB_URL || url === 'about:blank';
}

export function siteLabel(tab: TabSnapshot): string {
  if (isNewTab(tab.url)) return 'Yeni sekme';
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.host.replace(/^www\./, '');
  } catch {}
  return tab.title;
}

export function consoleErrorCount(tab: TabSnapshot): string {
  return tab.consoleErrors > 99 ? '99+' : String(tab.consoleErrors);
}

export function devStates(tab: TabSnapshot): string[] {
  const { overrides } = tab;
  return [
    tab.consoleErrors > 0 ? `${consoleErrorCount(tab)} konsol hatası` : null,
    overrides.cacheDisabled ? 'önbellek kapalı' : null,
    overrides.network === 'offline' ? 'çevrimdışı' : overrides.network ? 'ağ kısıtlı' : null,
    tab.autoReloadSeconds ? 'otomatik yenileniyor' : null,
    overrides.colorScheme ? `${overrides.colorScheme === 'dark' ? 'koyu' : 'açık'} tema taklidi` : null,
    overrides.reducedMotion ? 'azaltılmış hareket' : null,
    overrides.printMedia ? 'yazdırma görünümü' : null,
    overrides.userAgent ? 'user-agent değiştirildi' : null,
    overrides.requestRules ? 'istek kuralları uygulanıyor' : null,
  ].filter((state) => state !== null);
}
