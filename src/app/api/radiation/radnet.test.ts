import { describe, expect, it } from 'vitest';
import { baselineOf, classify, parseRadnetCsv, parseRadnetTime, radnetUrl, toStation, type RadnetReading } from './radnet';

const HEADER = 'LOCATION_NAME,SAMPLE COLLECTION TIME,DOSE EQUIVALENT RATE (nSv/h),GAMMA COUNT RATE R02 (CPM),GAMMA COUNT RATE R03 (CPM),GAMMA COUNT RATE R04 (CPM),GAMMA COUNT RATE R05 (CPM),GAMMA COUNT RATE R06 (CPM),GAMMA COUNT RATE R07 (CPM),GAMMA COUNT RATE R08 (CPM),GAMMA COUNT RATE R09 (CPM),STATUS';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 9, 1);

function week(values: number[]): RadnetReading[] {
  return values.map((nsvh, i) => ({ t: T0 + i * HOUR, nsvh }));
}

describe('parseRadnetCsv', () => {
  it('reads approved rows as UTC readings, oldest first', () => {
    const csv = [
      HEADER,
      'IL: CHICAGO,01/01/2026 01:49:00,54.00,1242.00,881.00,243.00,163.00,83.00,113.00,72.00,86.00,APPROVED',
      'IL: CHICAGO,01/01/2026 00:49:00,51.00,1204.00,848.00,235.00,158.00,79.00,109.00,72.00,88.00,APPROVED',
      'IL: CHICAGO,01/01/2026 02:49:00,,1202.00,863.00,236.00,159.00,80.00,115.00,74.00,85.00,APPROVED',
      'IL: CHICAGO,01/01/2026 03:49:00,99.00,1202.00,863.00,236.00,159.00,80.00,115.00,74.00,85.00,REJECTED',
      '',
    ].join('\r\n');
    expect(parseRadnetCsv(csv)).toEqual([
      { t: Date.UTC(2026, 0, 1, 0, 49), nsvh: 51 },
      { t: Date.UTC(2026, 0, 1, 1, 49), nsvh: 54 },
    ]);
  });

  it('returns nothing for a monitor with no rows this year', () => {
    expect(parseRadnetCsv(`${HEADER}\n`)).toEqual([]);
  });

  it('throws on a body that is not RadNet CSV', () => {
    expect(() => parseRadnetCsv('<html>maintenance</html>')).toThrow(/header/);
  });
});

describe('parseRadnetTime', () => {
  it('rejects malformed stamps', () => {
    expect(parseRadnetTime('2026-01-01 00:49')).toBeNull();
    expect(parseRadnetTime('09/15/2026 20:42:00')).toBe(Date.UTC(2026, 8, 15, 20, 42));
  });
});

describe('radnetUrl', () => {
  it('encodes site names with spaces and punctuation', () => {
    expect(radnetUrl({ state: 'NY', site: 'NYC (EML)' }, 2026))
      .toBe('https://radnet.epa.gov/cdx-radnet-rest/api/rest/csv/2026/fixed/NY/NYC%20(EML)');
  });
});

describe('baseline and bands', () => {
  const flat = Array.from({ length: 168 }, (_, i) => 40 + (i % 5) - 2);

  it('needs 48 prior readings before it rates anything', () => {
    expect(baselineOf(week([...flat.slice(0, 47), 41]))).toBeNull();
    expect(baselineOf(week([...flat.slice(0, 48), 41]))?.samples).toBe(48);
  });

  it('uses at most the 168 readings before the latest', () => {
    const b = baselineOf(week([1000, ...flat, 40]));
    expect(b?.samples).toBe(168);
    expect(b?.mean).toBeCloseTo(40, 0);
  });

  it('applies the +8/+15 nSv/h and z 2/3 bands', () => {
    const base = { mean: 40, sigma: 10, samples: 168 };
    expect(classify(47, base).status).toBe('NORMAL');
    expect(classify(48, base).status).toBe('ELEVATED');
    expect(classify(55, base)).toEqual({ status: 'SPIKE', delta: 15, z: 1.5 });
  });

  it('floors σ so a whole-number tick on a flat week is not a spike', () => {
    expect(classify(41, { mean: 40, sigma: 0, samples: 168 }).status).toBe('NORMAL');
    expect(classify(43, { mean: 40, sigma: 0, samples: 168 }).status).toBe('SPIKE');
  });

  it('is UNRATED without a baseline', () => {
    expect(classify(40, null)).toEqual({ status: 'UNRATED' });
  });
});

describe('toStation', () => {
  const monitor = { state: 'NY', site: 'NYC (EML)', city: 'New York', lat: 40.7128, lng: -74.006 };
  const readings = week([...Array(100).fill(40), 70]);
  const latestAt = readings.at(-1)!.t;

  it('rates a fresh reading against its own week', () => {
    expect(toStation(monitor, readings, latestAt + HOUR)).toMatchObject({
      id: 'radnet-ny-nyc-eml',
      name: 'RadNet New York',
      city: 'New York, NY',
      reading: 70,
      status: 'SPIKE',
      baseline: 40,
      delta: 30,
      network: 'EPA RadNet',
      time: new Date(latestAt).toISOString(),
    });
  });

  it('marks a monitor OFFLINE once its newest reading is 6 h old, and keeps it on the map', () => {
    const s = toStation(monitor, readings, latestAt + 6 * HOUR + 1);
    expect(s?.status).toBe('OFFLINE');
    expect(s?.delta).toBeUndefined();
    expect(s?.reading).toBe(70);
  });

  it('drops a monitor with no readings at all', () => {
    expect(toStation(monitor, [], T0)).toBeNull();
  });
});
