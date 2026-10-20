import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { Reporter } from '../context';
import type { Row } from '../xlsx';
import { dateTier, epicaEvents, epicaTime, matchQuakes, type Quake, records } from './epica';

const rec = (r: Record<string, string>) => ({ EqID: '10050000_0000_000', Year: '1005', Ax: 'Arezzo', Lat: '43.464', Lon: '11.882', LatUnc: '30', LonUnc: '30', Io: '6-7', Mw: '4.88', MwUnc: '0.43', MDPsSource: 'CASAL996', NMDP: '4', ...r });

const q = (key: string | number, iso: string, prec: number, lon = 10, lat = 45, mw: number | null = null): Quake => ({ key, t: Date.parse(`${iso.includes('T') ? iso : `${iso}T00:00:00`}Z`), prec, lon, lat, mw });

describe('epica', () => {
  it('keys sheet rows by the header', () => {
    const cell = (v: string) => ({ v, num: false, colour: null });
    const rows: Row[] = [
      { r: 1, cells: new Map([[1, cell('EqID')], [3, cell('Year')]]) },
      { r: 2, cells: new Map([[1, cell('x')], [3, cell('1005')]]) },
    ];
    expect(records(rows)).toEqual([{ EqID: 'x', Year: '1005' }]);
  });

  it('dates to the finest part given', () => {
    expect(epicaTime({ Year: '1005' })).toEqual({ t: Date.UTC(1005, 0, 1), prec: Prec.year });
    expect(epicaTime({ Year: '1000', Mo: '3', Da: '29' })).toEqual({ t: Date.UTC(1000, 2, 29), prec: Prec.day });
    expect(epicaTime({ Year: '1461', Mo: '11', Da: '27', Ho: '21', Mi: '5' })).toEqual({ t: Date.UTC(1461, 10, 27, 21, 5), prec: Prec.minute });
    expect(epicaTime({ Year: '1214', Mo: '8', Da: '29', Ho: '5' })).toMatchObject({ prec: Prec.hour });
  });

  it('makes quakes with Mw as magnitude, title-cases capitals and hollows vague epicentres', () => {
    const rep = new Reporter();
    const events = epicaEvents([
      rec({}),
      rec({ EqID: 'b', Ax: 'HAINAUT (CHARLEROI ?)', LatUnc: '99.9', Mw: '' }),
      rec({ EqID: 'c', Ax: '', Lat: '' }),
    ], rep);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'hazard.quake', title: 'Earthquake — Arezzo', magnitude: 4.88, geoPrec: GeoPrec.area, tStartPrec: Prec.year });
    expect(events[0].attrs).toMatchObject({ intensity_io: '6-7', epicentre_uncertainty_km: 30, url: 'https://www.emidius.eu/AHEAD/event/10050000_0000_000' });
    expect(events[1]).toMatchObject({ title: 'Earthquake — Hainaut (Charleroi ?)', magnitude: null, geoPrec: GeoPrec.approximate });
    expect(rep.toJSON().rejects).toEqual([{ reason: 'no epicentre', n: 1, sample: ['c'] }]);
  });

  it('compares dates at the coarser precision', () => {
    expect(dateTier(q(1, '1356-10-18T22:00:00', Prec.hour), q(2, '1356-10-18', Prec.day))).toBe(0);
    expect(dateTier(q(1, '1356-10-19', Prec.day), q(2, '1356-10-18', Prec.day))).toBe(1);
    expect(dateTier(q(1, '1356-10-21', Prec.day), q(2, '1356-10-18', Prec.day))).toBeNull();
    expect(dateTier(q(1, '1356-10-21', Prec.day), q(2, '1356-10-01', Prec.month))).toBe(2);
    expect(dateTier(q(1, '1356-10-21', Prec.day), q(2, '1356-01-01', Prec.year))).toBe(3);
    expect(dateTier(q(1, '1357-01-01', Prec.day), q(2, '1356-01-01', Prec.year))).toBeNull();
  });

  it('pairs one to one, so a sequence keeps its other shocks', () => {
    const noaa = [q(709, '1538-09-29', Prec.day, 14.1, 40.83), q(800, '1600-01-01', Prec.year, 10, 45)];
    const epica = [
      q('28a', '1538-09-28T06:00:00', Prec.minute, 14.12, 40.83),
      q('29a', '1538-09-29T11:00:00', Prec.minute, 14.12, 40.83),
      q('29b', '1538-09-29T18:30:00', Prec.minute, 14.12, 40.85),
      q('small', '1600-05-02', Prec.day, 10.1, 45, 4.1),
      q('big', '1600-09-02', Prec.day, 10.3, 45, 5.6),
      q('far', '1600-03-02', Prec.day, 12, 45, 6.5),
    ];
    const { pairs } = matchQuakes(epica, noaa);
    expect(pairs).toEqual([['29a', 709], ['big', 800]]);
  });
});
