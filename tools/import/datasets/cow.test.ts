import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { Reporter } from '../context';
import { readCsv } from '../csv';
import { cowDate, readTerritorialPlaces, TERRITORIAL_ROWS, WAC_MATCHES } from './cow';
import { readPlaces, yyyymm } from './icow';

describe('cow dates', () => {
  it('lowers the precision for -9 and NA parts and keeps the raw value', () => {
    const rep = new Reporter();
    expect(cowDate(rep, '1914', '7', '28')).toEqual({ t: Date.UTC(1914, 6, 28), prec: Prec.day });
    expect(cowDate(rep, '1914', '7', '-9')).toEqual({ t: Date.UTC(1914, 6, 1), prec: Prec.month, raw: '1914-7--9' });
    expect(cowDate(rep, '1914', '-9', '-9')).toEqual({ t: Date.UTC(1914, 0, 1), prec: Prec.year, raw: '1914--9--9' });
    expect(cowDate(rep, '2022', 'NA', 'NA')).toEqual({ t: Date.UTC(2022, 0, 1), prec: Prec.year, raw: '2022-NA-NA' });
    expect(rep.toJSON().sentinels).toEqual({ 'day -9 → month prec': 1, 'month -9 → year prec': 1, 'month NA → year prec': 1 });
  });

  it('never turns -8 or -9 years into dates', () => {
    const rep = new Reporter();
    expect(cowDate(rep, '-8', '-8', '-8')).toBeNull();
    expect(cowDate(rep, '-9', '1', '1')).toBeNull();
  });
});

describe('icow dates', () => {
  it('reads YYYYMM, with month 00 as year precision and 99 as no date', () => {
    const rep = new Reporter();
    expect(yyyymm(rep, '197108')).toEqual({ t: Date.UTC(1971, 7, 1), prec: Prec.month });
    expect(yyyymm(rep, '185000')).toEqual({ t: Date.UTC(1850, 0, 1), prec: Prec.year, raw: '185000' });
    expect(yyyymm(rep, '200199')).toBeNull();
  });
});

describe('icow places', () => {
  it('puts each claimed territory on the territory, not between its claimants', async () => {
    const places = await readPlaces();
    expect(places.size).toBe(593);
    expect(places.get('206\x1fGibraltar')).toEqual({ lon: -5.35, lat: 36.14 });
    expect(places.get('170\x1fFalkland (Malvinas) Is. & Dependencies')).toEqual({ lon: -59.5, lat: -51.75 });
    expect(places.get('716\x1fHatay (Alexandretta)')).toEqual({ lon: 36.2, lat: 36.3 });
  });
});

describe('cow territorial places', () => {
  it('names a place for every territory a row points at', async () => {
    const places = await readTerritorialPlaces();
    const rows = await readCsv(TERRITORIAL_ROWS);
    expect(rows).toHaveLength(842);
    const unplaced = rows.filter(r => !places.has(r.fix || r.entity)).map(r => r.number);
    expect(unplaced).toEqual(['879']);
    expect(places.get(rows.find(r => r.number === '5')!.entity)?.name).toBe('Gambia');
    expect(places.get(rows.find(r => r.number === '360')!.fix)).toEqual({ name: 'Clipperton Island', lon: -109.22, lat: 10.3 });
  });
});

describe('cow links', () => {
  it('lists each COW war once and maps WWII to the WAC row, not CNF-0002', () => {
    const wars = WAC_MATCHES.map(m => m[0]);
    expect(new Set(wars).size).toBe(wars.length);
    expect(WAC_MATCHES.find(m => m[0] === '139')?.[1]).toBe('CNF-0013');
  });
});
