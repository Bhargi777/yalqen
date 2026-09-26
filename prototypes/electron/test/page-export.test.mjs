// Runs against the compiled main-process modules (npm test builds them first).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import pageExport from '../dist/main/page-export.js';

const { canViewSource, pdfFileName } = pageExport;

test('PDF names come from the title, cleaned for file systems', () => {
  assert.equal(pdfFileName('Haberler: Gündem / Son dakika?', 'https://a.com/'), 'Haberler Gündem Son dakika.pdf');
  assert.equal(pdfFileName('  ..gizli.. ', 'https://a.com/'), 'gizli.pdf');
  assert.equal(pdfFileName('x'.repeat(200), 'https://a.com/'), `${'x'.repeat(120)}.pdf`);
});

test('pages without a title use their host', () => {
  assert.equal(pdfFileName('', 'https://www.example.com/a'), 'example.com.pdf');
  assert.equal(pdfFileName('https://example.com/a', 'https://example.com/a'), 'example.com.pdf');
  assert.equal(pdfFileName('', 'about:blank'), 'sayfa.pdf');
});

test('only web pages and files have a source to show', () => {
  assert.equal(canViewSource('https://a.com/'), true);
  assert.equal(canViewSource('file:///tmp/a.html'), true);
  assert.equal(canViewSource('view-source:https://a.com/'), false);
  assert.equal(canViewSource('yalqen://newtab/'), false);
});
