// Runs against the compiled main-process modules (npm test builds them first).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import errorPage from '../dist/main/error-page.js';

const { describeError, errorPageHtml, errorPageScript } = errorPage;

test('common failures get a specific explanation', () => {
  assert.equal(describeError(-106, 'https://a.com/').title, 'İnternet bağlantısı yok');
  assert.equal(describeError(-105, 'https://a.com/x').message, 'a.com sunucusunun adresi bulunamadı.');
  assert.equal(describeError(-102, 'http://localhost:3000/').message, 'localhost:3000 bağlanmayı reddetti.');
  assert.equal(describeError(-118, 'https://a.com/').message, 'a.com çok uzun süre yanıt vermedi.');
  assert.equal(describeError(-202, 'https://a.com/').title, 'Bağlantı güvenli değil');
  assert.equal(describeError(-999, 'https://a.com/').title, 'Bu sayfa açılamadı');
});

test('page text is escaped', () => {
  const html = errorPageHtml(-105, 'ERR_<b>', 'https://<script>.com/');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('ERR_<b>'));
  assert.ok(html.includes('ERR_&#60;b&#62;'));
});

test('the script only replaces Chromium error documents and retries the failed address', () => {
  const url = "https://a.com/?q='\"</script>";
  const script = errorPageScript(-105, 'ERR_NAME_NOT_RESOLVED', url);
  let replaced = null;
  const retry = { addEventListener: (_type, listener) => listener() };
  const run = (protocol) => {
    const document = { documentElement: { innerHTML: '' }, getElementById: () => retry };
    new Function('location', 'document', script)({ protocol, replace: (next) => (replaced = next) }, document);
    return document.documentElement.innerHTML;
  };
  assert.equal(run('https:'), '');
  assert.equal(replaced, null);
  assert.match(run('chrome-error:'), /Bu siteye ulaşılamıyor/);
  assert.equal(replaced, url);
});
