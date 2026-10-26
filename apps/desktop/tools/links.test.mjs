import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appUserAgent, linkIn, linkPath, openable, sameSite } from '../links.mjs';
import { ico } from './make-icons.mjs';
import { offlinePage, offlineStrings } from './make-offline.mjs';

const SITE = new URL('https://takip.dev');

test('a sign-in link opens /app/verify with the same query', () => {
  assert.equal(linkPath('dev.takip.app://auth?ott=tok&return=%2F&state=s'), '/app/verify?ott=tok&return=%2F&state=s');
});

test('every other link on the scheme, and anything that is not one, is ignored', () => {
  for (const link of ['dev.takip.app://settings?x=1', 'https://takip.dev/app/verify', 'not a link', '']) assert.equal(linkPath(link), null);
});

test('Windows and Linux hand the link over as an argument', () => {
  assert.equal(linkIn(['TAKIP.exe', '--flag', 'dev.takip.app://auth?ott=1']), 'dev.takip.app://auth?ott=1');
  assert.equal(linkIn(['TAKIP.exe']), null);
});

test('only the site stays in the window', () => {
  assert.equal(sameSite('https://takip.dev/city/istanbul', SITE), true);
  assert.equal(sameSite('https://accounts.google.com/o/oauth2', SITE), false);
  assert.equal(sameSite('http://takip.dev/', SITE), false);
  assert.equal(sameSite('garbage', SITE), false);
});

test('only web and mail links leave for the system', () => {
  assert.equal(openable('https://example.com'), true);
  assert.equal(openable('mailto:hello@takip.dev'), true);
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'smb://host/share', 'dev.takip.app://auth']) assert.equal(openable(url), false);
});

test('the user agent carries the token the site reads', () => {
  assert.match(appUserAgent('Mozilla/5.0 Chrome/142', '1.0.0', 'windows'), /\bTAKIPApp\/1\.0\.0 \(windows\)$/);
});

test('the offline page has every catalog language and no stray markup', () => {
  const strings = offlineStrings();
  assert.ok(Object.keys(strings).length >= 10, Object.keys(strings).join());
  assert.equal(strings.en.retry, 'Try again');
  const page = offlinePage(strings, '<svg></svg>');
  assert.match(page, /Content-Security-Policy/);
  assert.ok(!page.includes('</script><'), 'strings close the script early');
});

test('an .ico lists each frame at its offset', () => {
  const frames = [{ size: 16, png: Buffer.from('aa') }, { size: 256, png: Buffer.from('bbb') }];
  const file = ico(frames);
  assert.equal(file.readUInt16LE(4), 2);
  assert.equal(file.readUInt8(6 + 16), 0);
  assert.equal(file.readUInt32LE(6 + 12), 6 + 32);
  assert.equal(file.readUInt32LE(6 + 16 + 12), 6 + 32 + 2);
  assert.equal(file.subarray(6 + 32).toString(), 'aabbb');
});
