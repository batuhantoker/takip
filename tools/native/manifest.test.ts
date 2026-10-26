import { describe, expect, it } from 'vitest';
import { describeFile, newestOnly } from './manifest.mjs';

describe('describeFile', () => {
  it('reads platform, kind, arch and version from the build names', () => {
    expect(describeFile('TAKIP-1.0.0-android.apk')).toEqual({ platform: 'android', kind: 'apk', arch: 'universal', version: '1.0.0' });
    expect(describeFile('TAKIP-1.2.0-mac-universal.dmg')).toEqual({ platform: 'macos', kind: 'dmg', arch: 'universal', version: '1.2.0' });
    expect(describeFile('TAKIP-1.2.0-win-x64.exe')).toEqual({ platform: 'windows', kind: 'exe', arch: 'x64', version: '1.2.0' });
    expect(describeFile('TAKIP-1.2.0-linux-x86_64.AppImage')).toEqual({ platform: 'linux', kind: 'appimage', arch: 'x86_64', version: '1.2.0' });
    expect(describeFile('TAKIP-1.2.0-linux-amd64.deb')).toEqual({ platform: 'linux', kind: 'deb', arch: 'amd64', version: '1.2.0' });
  });

  it('skips update metadata, blockmaps and anything else', () => {
    for (const name of ['latest-mac.yml', 'TAKIP-1.2.0-mac-universal.dmg.blockmap', 'TAKIP-1.2.0-mac-universal.zip', 'app-debug.apk']) {
      expect(describeFile(name)).toBeNull();
    }
  });
});

describe('newestOnly', () => {
  it('keeps the newest build of each file', () => {
    const f = (name: string) => ({ name, ...describeFile(name)! });
    const kept = newestOnly([f('TAKIP-1.9.0-win-x64.exe'), f('TAKIP-1.10.0-win-x64.exe'), f('TAKIP-1.0.0-android.apk')]);
    expect(kept.map(k => k.name)).toEqual(['TAKIP-1.0.0-android.apk', 'TAKIP-1.10.0-win-x64.exe']);
  });

  it('keeps the first of two builds of one version, so a fresh collect replaces the old checksum', () => {
    const fresh = { name: 'TAKIP-1.0.0-android.apk', ...describeFile('TAKIP-1.0.0-android.apk')!, sha256: 'new' };
    expect(newestOnly([fresh, { ...fresh, sha256: 'old' }])[0].sha256).toBe('new');
  });
});
