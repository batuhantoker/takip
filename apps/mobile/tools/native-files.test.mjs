import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offlinePage, versionCode } from './native-files.mjs';

test('versionCode grows with every release', () => {
  assert.equal(versionCode('1.0.0'), 10000);
  assert.equal(versionCode('1.2.3'), 10203);
  assert.ok(versionCode('2.0.0') > versionCode('1.99.99'));
  assert.throws(() => versionCode('1.0'));
  assert.throws(() => versionCode('1.100.0'));
});

test('the offline page retries the site and escapes its text', () => {
  const html = offlinePage({ url: 'https://takip.dev', strings: { en: ['Offline', 'A <b> & c', 'Try again'], tr: ['Çevrimdışı', 'x', 'Tekrar dene'] }, mark: '<svg></svg>' });
  assert.match(html, /location\.replace\("https:\/\/takip\.dev"\)/);
  assert.match(html, /A &lt;b&gt; &amp; c/);
  assert.match(html, /"tr":\["Çevrimdışı"/);
  assert.match(html, /viewport-fit=cover/);
});
