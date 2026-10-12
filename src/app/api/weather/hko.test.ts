import { describe, expect, it } from 'vitest';
import { parseHkoWarnsum } from './hko';

describe('parseHkoWarnsum', () => {
  it('is empty when no warning is in force', () => {
    expect(parseHkoWarnsum({})).toEqual([]);
  });

  it('maps each warning in force and grades typhoon and rainstorm signals', () => {
    const out = parseHkoWarnsum({
      WTCSGNL: { name: 'Tropical Cyclone Warning Signal', code: 'TC8NE', type: 'Gale or Storm Signal No. 8 Northeast', actionCode: 'ISSUE', issueTime: '2026-10-12T08:40:00+08:00', updateTime: '2026-10-12T09:45:00+08:00' },
      WRAIN: { name: 'Rainstorm Warning Signal', code: 'WRAINA', actionCode: 'ISSUE', issueTime: '2026-10-12T09:00:00+08:00' },
      WFIRE: { name: 'Fire Danger Warning', code: 'WFIREY', actionCode: 'CANCEL' },
    });
    expect(out).toEqual([
      {
        id: 'hko-WTCSGNL-TC8NE',
        title: 'Tropical Cyclone Warning Signal — Gale or Storm Signal No. 8 Northeast (TC8NE)',
        category: 'weatherAlerts',
        type: 'Tropical Cyclone Warning Signal',
        icon: 'cyclone',
        severity: 'high',
        lat: 22.3193,
        lng: 114.1694,
        date: '2026-10-12T01:45:00.000Z',
        expires: undefined,
        area: 'Hong Kong',
        source: 'https://www.hko.gov.hk/en/wxinfo/dailywx/wxwarntoday.htm',
        provider: 'HKO',
      },
      expect.objectContaining({ id: 'hko-WRAIN-WRAINA', severity: 'medium', icon: 'weather', date: '2026-10-12T01:00:00.000Z' }),
    ]);
  });

  it('throws on an unexpected body', () => {
    expect(() => parseHkoWarnsum([])).toThrow(/shape/);
    expect(() => parseHkoWarnsum(null)).toThrow(/shape/);
  });
});
