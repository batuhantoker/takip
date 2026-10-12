import { describe, expect, it } from 'vitest';
import { describeDevice, timeAgo } from './device-label';

describe('describeDevice', () => {
  it.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', 'Chrome on macOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Safari on iOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1', 'Chrome on iOS'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36', 'Chrome on Android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0', 'Edge on Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox on Linux'],
    ['curl/8.7.1', 'Unknown device'],
    [null, 'Unknown device'],
  ])('%s → %s', (ua, label) => {
    expect(describeDevice(ua)).toBe(label);
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  it.each([
    ['2026-10-12T11:59:30Z', 'just now'],
    ['2026-10-12T11:55:00Z', '5 minutes ago'],
    ['2026-10-12T09:00:00Z', '3 hours ago'],
    ['2026-10-11T11:00:00Z', 'yesterday'],
    ['2026-08-01T12:00:00Z', '2 months ago'],
  ])('%s → %s', (date, label) => {
    expect(timeAgo(date, now)).toBe(label);
  });
});
