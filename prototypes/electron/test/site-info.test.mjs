// Runs against the compiled main-process modules (npm test builds them first).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import siteInfo from '../dist/main/site-info.js';

const { securityState, siteInfoTemplate } = siteInfo;

test('web pages are secure over https and insecure over http', () => {
  assert.equal(securityState('https://example.com/'), 'secure');
  assert.equal(securityState('http://example.com/'), 'insecure');
  assert.equal(securityState('http://localhost:3000/'), 'insecure');
});

test('pages not fetched from a site have no connection state', () => {
  for (const url of ['yalqen://newtab/', 'about:blank', 'file:///tmp/a.html', 'data:text/plain,x', 'not a url']) {
    assert.equal(securityState(url), 'local', url);
  }
});

test('the menu names the site and its connection', () => {
  const labels = (info) => siteInfoTemplate(info).map((item) => item.label);
  assert.deepEqual(labels({ url: 'https://www.example.com/a', security: 'secure' }), ['www.example.com', 'Bağlantı güvenli']);
  assert.deepEqual(labels({ url: 'http://example.com:8080/', security: 'insecure' }), [
    'example.com:8080',
    'Bu siteye bağlantı güvenli değil',
  ]);
});
