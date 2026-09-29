import assert from 'node:assert/strict';
import { test } from 'node:test';
import manifests from '../dist/main/extension-manifest.js';
import popup from '../dist/main/extension-popup.js';
import extensions from '../dist/main/extensions.js';

const {
  actionTitle,
  extensionPage,
  iconFile,
  localize,
  optionsPage,
  parseMessages,
  popupPage,
  resolveInside,
  sanitizeSavedExtensions,
} = manifests;
const { popupBounds, sanitizeAnchor } = popup;
const { errorMessage, extensionsMenuTemplate } = extensions;

test('saved extensions keep unique absolute folders', () => {
  assert.deepEqual(
    sanitizeSavedExtensions([
      { path: '/ext/a' },
      { path: '/ext/a', enabled: false },
      { path: 'relative/b' },
      { path: '/ext/c', enabled: false },
      'nope',
    ]),
    [
      { path: '/ext/a', enabled: true },
      { path: '/ext/c', enabled: false },
    ],
  );
  assert.deepEqual(sanitizeSavedExtensions({}), []);
});

test('the toolbar action is read from manifest v3 and v2 keys', () => {
  const v3 = { action: { default_popup: 'popup.html', default_title: 'Dark' }, options_ui: { page: 'options.html' } };
  const v2 = { browser_action: { default_popup: '/ui/popup.html' }, options_page: 'settings.html' };
  assert.deepEqual([popupPage(v3), actionTitle(v3, 'Name'), optionsPage(v3)], ['popup.html', 'Dark', 'options.html']);
  assert.deepEqual(
    [popupPage(v2), actionTitle(v2, 'Name'), optionsPage(v2)],
    ['/ui/popup.html', 'Name', 'settings.html'],
  );
  assert.deepEqual([popupPage({}), optionsPage({ options_ui: { page: '' } })], [null, null]);
});

test('icons prefer the smallest size that is large enough', () => {
  const manifest = { icons: { 16: 'i16.png', 48: 'i48.png', 128: 'i128.png' } };
  assert.equal(iconFile(manifest, 32), 'i48.png');
  assert.equal(iconFile(manifest, 256), 'i128.png');
  assert.equal(iconFile({ action: { default_icon: 'one.png' } }, 16), 'one.png');
  assert.equal(iconFile({ action: { default_icon: { 19: 'a.png', 38: 'b.png' } } }, 32), 'b.png');
  assert.equal(iconFile({}, 16), null);
});

test('extension files and pages cannot leave the extension', () => {
  assert.equal(resolveInside('/ext/a', 'icons/i.png'), '/ext/a/icons/i.png');
  assert.equal(resolveInside('/ext/a', '/icons/i.png'), '/ext/a/icons/i.png');
  assert.equal(resolveInside('/ext/a', '../b/secret.png'), null);
  assert.equal(extensionPage('chrome-extension://abc/', '/ui/popup.html'), 'chrome-extension://abc/ui/popup.html');
  assert.equal(extensionPage('chrome-extension://abc/', '../../x.html'), 'chrome-extension://abc/x.html');
  assert.equal(extensionPage('chrome-extension://abc/', null), null);
});

test('manifest messages are localized case-insensitively', () => {
  const messages = parseMessages({ appName: { message: 'Karanlık Okuyucu' }, empty: { message: '' }, bad: 1 });
  assert.deepEqual(messages, { appname: 'Karanlık Okuyucu' });
  assert.equal(localize('__MSG_APPNAME__ v2', messages), 'Karanlık Okuyucu v2');
  assert.equal(localize('__MSG_missing__', messages), '__MSG_missing__');
});

test('popups open under the button and stay inside the window', () => {
  const anchor = { x: 900, y: 8, width: 28, height: 28 };
  assert.deepEqual(popupBounds(anchor, { width: 300, height: 200 }, { width: 1280, height: 800 }), {
    x: 628,
    y: 42,
    width: 300,
    height: 200,
  });
  assert.deepEqual(popupBounds(anchor, { width: 2000, height: 2000 }, { width: 1280, height: 400 }), {
    x: 128,
    y: 42,
    width: 800,
    height: 350,
  });
  assert.deepEqual(
    popupBounds({ x: 4, y: 8, width: 28, height: 28 }, { width: 10, height: 10 }, { width: 640, height: 400 }),
    {
      x: 8,
      y: 42,
      width: 25,
      height: 25,
    },
  );
});

test('anchors from the chrome are sanitized', () => {
  assert.deepEqual(sanitizeAnchor({ x: 10.5, y: -3, width: 'wide', height: Infinity }), {
    x: 10.5,
    y: 0,
    width: 0,
    height: 0,
  });
  assert.deepEqual(sanitizeAnchor(null), { x: 0, y: 0, width: 0, height: 0 });
});

test('the extensions menu opens popups, falls back to options and links to management', () => {
  const calls = [];
  const handlers = {
    openPopup: (url) => calls.push(['popup', url]),
    openOptions: (url) => calls.push(['options', url]),
    manage: () => calls.push(['manage']),
  };
  const items = extensionsMenuTemplate(
    [
      { title: 'Zeta', icon: null, popupUrl: 'chrome-extension://z/popup.html', optionsUrl: null },
      { title: 'Alfa', icon: null, popupUrl: null, optionsUrl: 'chrome-extension://a/options.html' },
      { title: 'Boş', icon: null, popupUrl: null, optionsUrl: null },
    ],
    handlers,
  );
  assert.deepEqual(
    items.map((item) => item.label ?? '-'),
    ['Alfa', 'Boş', 'Zeta', '-', 'Uzantıları yönet…'],
  );
  assert.equal(items[1].enabled, false);
  items[0].click();
  items[2].click();
  items[4].click();
  assert.deepEqual(calls, [
    ['options', 'chrome-extension://a/options.html'],
    ['popup', 'chrome-extension://z/popup.html'],
    ['manage'],
  ]);
  assert.deepEqual(
    extensionsMenuTemplate([], handlers).map((item) => item.label),
    ['Uzantıları yönet…'],
  );
});

test('load errors drop the folder prefix Electron adds', () => {
  assert.equal(
    errorMessage(new Error('Loading extension at /a b/ext failed with: Manifest file is missing or unreadable')),
    'Manifest file is missing or unreadable',
  );
  assert.equal(errorMessage('plain'), 'plain');
});
