import assert from 'node:assert/strict';
import { test } from 'node:test';
import cookies from '../dist/main/third-party-cookies.js';

const { headerValues, isThirdParty, requestCookieNames, responseCookieNames, siteOf } = cookies;

test('sites are registrable domains, public suffixes included', () => {
  assert.equal(siteOf('https://www.example.com/a'), 'example.com');
  assert.equal(siteOf('https://a.b.gov.tr/'), 'b.gov.tr');
  assert.equal(siteOf('https://shop.example.co.uk/'), 'example.co.uk');
  assert.equal(siteOf('http://127.0.0.1:8080/'), '127.0.0.1');
  assert.equal(siteOf('http://localhost/'), 'localhost');
  assert.equal(siteOf('wss://chat.example.com/'), 'example.com');
  assert.equal(siteOf('yalqen://newtab/'), null);
  assert.equal(siteOf('nope'), null);
});

test('requests to another site are third party', () => {
  assert.equal(isThirdParty('https://cdn.example.com/x.js', 'https://www.example.com/'), false);
  assert.equal(isThirdParty('https://tracker.net/p', 'https://www.example.com/'), true);
  assert.equal(isThirdParty('https://a.gov.tr/', 'https://b.gov.tr/'), true);
  assert.equal(isThirdParty('https://tracker.net/p', 'yalqen://newtab/'), true);
  assert.equal(isThirdParty('data:text/plain,x', 'https://example.com/'), false);
});

test('cookie names are read from request and response headers', () => {
  assert.deepEqual(requestCookieNames('a=1; b=two=2;  c='), ['a', 'b', 'c']);
  assert.deepEqual(responseCookieNames(['id=9; Path=/; HttpOnly', ' x = 1 ', '=nameless']), ['id', 'x']);
  assert.deepEqual(headerValues({ 'Set-Cookie': ['a=1'], 'set-cookie': 'b=2', Other: 'x' }, 'set-cookie'), [
    'a=1',
    'b=2',
  ]);
  assert.deepEqual(headerValues(undefined, 'set-cookie'), []);
});

test('request listeners are attached only while blocking is on', () => {
  const calls = [];
  const webRequest = Object.fromEntries(
    ['onBeforeSendHeaders', 'onCompleted', 'onErrorOccurred'].map((name) => [
      name,
      (listener) => calls.push([name, listener !== null]),
    ]),
  );
  const session = { webRequest, cookies: { remove: async () => {} } };
  cookies.setThirdPartyCookieBlocking(session, false);
  assert.deepEqual(calls, []);
  cookies.setThirdPartyCookieBlocking(session, true);
  cookies.setThirdPartyCookieBlocking(session, true);
  assert.deepEqual(calls, [
    ['onBeforeSendHeaders', true],
    ['onCompleted', true],
    ['onErrorOccurred', true],
  ]);
  calls.length = 0;
  cookies.setThirdPartyCookieBlocking(session, false);
  assert.deepEqual(calls, [
    ['onBeforeSendHeaders', false],
    ['onCompleted', false],
    ['onErrorOccurred', false],
  ]);
});
