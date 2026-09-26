import { NEW_TAB_URL } from '../shared/types.js';

/** Chromium's code for a navigation that was stopped or replaced; not an error to show. */
export const ERR_ABORTED = -3;

export interface ErrorText {
  title: string;
  message: string;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** Chromium's certificate errors are -200 to -299. */
export function isCertificateError(code: number): boolean {
  return code <= -200 && code > -300;
}

/** Explains a failed page load; `code` is Chromium's net error code. */
export function describeError(code: number, url: string): ErrorText {
  const host = hostOf(url);
  switch (code) {
    case -106:
      return { title: 'İnternet bağlantısı yok', message: 'Ağ bağlantınızı kontrol edip yeniden deneyin.' };
    case -105:
    case -137:
      return { title: 'Bu siteye ulaşılamıyor', message: `${host} sunucusunun adresi bulunamadı.` };
    case -102:
      return { title: 'Bu siteye ulaşılamıyor', message: `${host} bağlanmayı reddetti.` };
    case -7:
    case -118:
      return { title: 'Bu siteye ulaşılamıyor', message: `${host} çok uzun süre yanıt vermedi.` };
    case -100:
    case -101:
    case -324:
      return { title: 'Bu siteye ulaşılamıyor', message: `${host} ile bağlantı beklenmedik biçimde kesildi.` };
    case -20:
      return { title: 'Bu sayfa engellendi', message: `${host} reklam engelleyici tarafından engellendi.` };
    case -312:
      return { title: 'Bu adres engellendi', message: 'Bu adrese güvenlik nedeniyle erişilemez.' };
    default:
      if (isCertificateError(code)) {
        return {
          title: 'Bağlantı güvenli değil',
          message: `${host} için güvenli bir bağlantı kurulamadı. Saldırganlar bu siteden parola, mesaj veya kart bilgilerinizi çalmaya çalışıyor olabilir.`,
        };
      }
      return { title: 'Bu sayfa açılamadı', message: `${host} yüklenirken bir hata oluştu.` };
  }
}

/**
 * Markup of the error page shown in place of a page that failed to load. With
 * `proceedUrl` it is a certificate warning that offers to continue anyway.
 */
export function errorPageHtml(code: number, name: string, url: string, proceedUrl: string | null = null): string {
  const { title, message } = describeError(code, url);
  return `<head><meta charset="utf-8"><title>${escapeHtml(hostOf(url))}</title><style>
:root { color-scheme: light dark; --text: #1a1b1e; --muted: #6b6e75; --accent: #f28c28; --page: #fff; }
@media (prefers-color-scheme: dark) { :root { --text: #eceef1; --muted: #9a9ea6; --page: #1f2124; } }
html, body { height: 100%; margin: 0; }
body { display: grid; place-items: center; padding: 24px; box-sizing: border-box; background: var(--page); color: var(--text);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
main { max-width: 520px; }
h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -.02em; }
p { margin: 0 0 6px; color: var(--muted); overflow-wrap: anywhere; }
code { font-size: 12px; color: var(--muted); }
button { margin-top: 20px; padding: 8px 16px; border: 0; border-radius: 999px; background: var(--accent); color: #fff; font: inherit; font-weight: 600; }
button:hover { filter: brightness(1.05); }
button.link { display: block; margin-top: 12px; padding: 0; background: none; color: var(--muted); font-weight: 400; text-decoration: underline; }
</style></head><body><main>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
<code>${escapeHtml(name)}</code><br>
${
    proceedUrl
      ? '<button id="back" type="button">Güvenliğe dön</button><button id="proceed" class="link" type="button">Yine de devam et (güvenli değil)</button>'
      : '<button id="retry" type="button">Yeniden dene</button>'
  }
</main></body>`;
}

/**
 * Script that fills Chromium's empty error document, which keeps the failed
 * address in the address bar and history. It does nothing on any other page.
 */
export function errorPageScript(code: number, name: string, url: string, proceedUrl: string | null = null): string {
  return `(() => {
  if (location.protocol !== 'chrome-error:') return;
  document.documentElement.innerHTML = ${JSON.stringify(errorPageHtml(code, name, url, proceedUrl))};
  const on = (id, listener) => document.getElementById(id)?.addEventListener('click', listener);
  on('retry', () => location.replace(${JSON.stringify(url)}));
  on('back', () => (history.length > 1 ? history.back() : location.replace(${JSON.stringify(NEW_TAB_URL)})));
  on('proceed', () => location.assign(${JSON.stringify(proceedUrl)}));
})();`;
}
