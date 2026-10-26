import { describe, expect, it } from 'vitest';
import type { DownloadFile } from './downloads';
import { appUpdate } from './updates';

const file = (platform: DownloadFile['platform'], version: string): DownloadFile =>
  ({ platform, version, kind: 'exe', arch: 'x64', name: `TAKIP-${version}-x.exe`, bytes: 1, sha256: '', signed: false });
const downloads = { date: '2026-10-24', files: [file('windows', '1.2.0'), file('windows', '1.10.0'), file('android', '1.0.0')] };

describe('appUpdate', () => {
  it('names the newest build for an older shell', () => {
    expect(appUpdate({ platform: 'windows', version: '1.9.3' }, downloads)).toBe('1.10.0');
  });

  it('is null when the shell is current, newer, has no file here, or is a browser', () => {
    expect(appUpdate({ platform: 'windows', version: '1.10.0' }, downloads)).toBeNull();
    expect(appUpdate({ platform: 'android', version: '1.1.0' }, downloads)).toBeNull();
    expect(appUpdate({ platform: 'ios', version: '0.9.0' }, downloads)).toBeNull();
    expect(appUpdate(null, downloads)).toBeNull();
    expect(appUpdate({ platform: 'linux', version: '1.0.0' }, null)).toBeNull();
  });

  it('leaves a system with a store listing to the store', () => {
    expect(appUpdate({ platform: 'android', version: '0.9.0' }, downloads, { android: 'https://play.google.com/store/apps/details?id=dev.takip.app' })).toBeNull();
    expect(appUpdate({ platform: 'android', version: '0.9.0' }, downloads)).toBe('1.0.0');
  });
});
