import { describe, expect, it } from 'vitest';
import { parseDownloads, visitorPlatform } from './downloads';

const SHA = 'a'.repeat(64);
const apk = { platform: 'android', kind: 'apk', arch: 'universal', name: 'TAKIP-1.0.0-android.apk', bytes: 4560492, sha256: SHA, signed: true };

describe('parseDownloads', () => {
  it('keeps the files it can serve', () => {
    const dmg = { platform: 'macos', kind: 'dmg', arch: 'universal', name: 'TAKIP-1.0.0-mac-universal.dmg', bytes: 1, sha256: SHA };
    expect(parseDownloads({ date: '2026-10-24', files: [apk, dmg] })).toEqual({
      date: '2026-10-24', files: [{ ...apk, version: '1.0.0' }, { ...dmg, version: '1.0.0', signed: false }],
    });
  });

  it('drops files whose name, kind or checksum it would not serve', () => {
    const bad = [
      { ...apk, name: '../../.env.local' },
      { ...apk, name: 'TAKIP-1.0.0-android.apk/../x' },
      { ...apk, name: 'TAKIP-1.0.0-android.sh' },
      { ...apk, kind: 'sh' },
      { ...apk, platform: 'tvos' },
      { ...apk, sha256: 'nope' },
      { ...apk, bytes: 'big' },
      null,
    ];
    expect(parseDownloads({ date: '2026-10-24', files: bad })?.files).toEqual([]);
  });

  it('is null for anything that is not a manifest', () => {
    for (const raw of [null, 'x', [], { date: 1, files: [] }, { date: '2026-10-24' }]) {
      expect(parseDownloads(raw)).toBeNull();
    }
  });
});

describe('visitorPlatform', () => {
  it("names the visitor's system", () => {
    expect(visitorPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios');
    expect(visitorPlatform('Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36')).toBe('android');
    expect(visitorPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36')).toBe('windows');
    expect(visitorPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15')).toBe('macos');
    expect(visitorPlatform('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36')).toBe('linux');
  });

  it('is null when it cannot tell', () => {
    expect(visitorPlatform(null)).toBeNull();
    expect(visitorPlatform('curl/8.7.1')).toBeNull();
  });
});
