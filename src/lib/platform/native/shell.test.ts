import { describe, expect, it } from 'vitest';
import { appShell, isPhoneApp } from './shell';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const ANDROID = 'Mozilla/5.0 (Linux; Android 16; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36';

describe('appShell', () => {
  it('reads the platform and version the apps add', () => {
    expect(appShell(`${IPHONE} TAKIPApp/1.0.0 (ios)`)).toEqual({ platform: 'ios', version: '1.0.0' });
    expect(appShell(`${ANDROID} TAKIPApp/1.2.3 (android)`)).toEqual({ platform: 'android', version: '1.2.3' });
    expect(appShell('Mozilla/5.0 (Macintosh) Chrome/142.0 Electron/45.0.0 Safari/537.36 TAKIPApp/1.0.0 (macos)')?.platform).toBe('macos');
  });

  it('is null in a browser, or for a platform it does not know', () => {
    for (const ua of [null, undefined, '', IPHONE, ANDROID, `${IPHONE} TAKIPApp/1.0.0 (tvos)`, `${IPHONE} TAKIPApp/1.0 (ios)`]) {
      expect(appShell(ua)).toBeNull();
    }
  });
});

describe('isPhoneApp', () => {
  it('is true for the iOS and Android apps only', () => {
    expect(isPhoneApp({ platform: 'ios', version: '1.0.0' })).toBe(true);
    expect(isPhoneApp({ platform: 'android', version: '1.0.0' })).toBe(true);
    expect(isPhoneApp({ platform: 'windows', version: '1.0.0' })).toBe(false);
    expect(isPhoneApp(null)).toBe(false);
  });
});
