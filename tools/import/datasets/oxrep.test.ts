import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { Reporter } from '../context';
import { utc } from '../dates';
import type { Row } from '../xlsx';
import { astronomical, oxrepEvents, realign } from './oxrep';

const wreck = (r: Record<string, string>) => ({
  locid: '2335', 'Site Name': 'Aci Trezza', 'Wreck Name': 'Aci Trezza 1', Latitude: '37.55917', Longitude: '15.1656', 'Earliest Date': '1', 'Latest Date': '400',
  'Dating comment': 'C1st-4th AD', 'Wreck ID': '9030', Country: 'Italy', Region: 'Sicily', Depth: '35m', Period: 'Roman Imperial', Amphorae: '1', Marble: '0', ...r,
});

const row = (cells: [number, string][]): Row => ({ r: 5, cells: new Map(cells.map(([c, v]) => [c, { v, num: false, colour: null }])) });

describe('oxrep', () => {
  it('moves the two rows that sit two columns right back into place', () => {
    const shifted = row([[1, '2267'], [6, '100'], [11, '7439'], [13, '5'], [14, 'Tyrrhenian Sea'], [15, 'Italy'], [23, '1'], [24, '0'], [25, '0'], [26, '0'], [27, '0']]);
    expect([...realign(shifted).cells].map(([c, v]) => [c, v.v])).toEqual([[1, '2267'], [6, '100'], [9, '7439'], [11, '5'], [12, 'Tyrrhenian Sea'], [13, 'Italy'], [21, '1'], [22, '0'], [23, '0'], [24, '0'], [25, '0']]);
    const fine = row([[9, '9030'], [21, '1'], [22, '0'], [23, '0'], [24, '0'], [25, '0']]);
    expect(realign(fine)).toBe(fine);
    const sparse = row([[9, '9016'], [12, 'Black Sea']]);
    expect(realign(sparse)).toBe(sparse);
  });

  it('counts BC years astronomically', () => {
    expect(astronomical(-150)).toBe(-149);
    expect(astronomical(0)).toBe(0);
    expect(astronomical(400)).toBe(400);
  });

  it('dates a wreck by its range, placed hollow at the blurred point', () => {
    const rep = new Reporter();
    const events = oxrepEvents([
      wreck({}),
      wreck({ 'Wreck ID': '', locid: '', 'Wreck Name': 'Kaliakra 2', 'Earliest Date': '-330', 'Latest Date': '-50', 'Dating comment': '' }),
      wreck({ 'Wreck ID': '', locid: '', 'Wreck Name': 'Kaliakra 2', 'Earliest Date': '-330', 'Latest Date': '-330' }),
      wreck({ 'Wreck ID': '1', Latitude: '' }),
      wreck({ 'Wreck ID': '2', 'Earliest Date': '', 'Latest Date': '' }),
    ], rep);
    expect(events).toHaveLength(3);
    const [a, b, c] = events;
    expect(a).toMatchObject({
      kind: 'accident.shipwreck', sourceRecordId: 'wreck:9030', title: 'Shipwreck — Aci Trezza 1', tStart: utc(1),
      tStartPrec: Prec.year, tEnd: Date.UTC(400, 0, 1), tEndPrec: Prec.year, geoPrec: GeoPrec.approximate,
    });
    expect(a.attrs).toMatchObject({ dated: 'C1st-4th AD', cargo: ['amphorae'], depth: '35m', country: 'Italy' });
    expect(b.sourceRecordId).toBe('name:Kaliakra 2');
    expect(new Date(b.tStart).getUTCFullYear()).toBe(-329);
    expect(b.attrs?.dated).toBe('between 330 BC and 50 BC');
    expect(c).toMatchObject({ sourceRecordId: 'name:Kaliakra 2#2', tEnd: null });
    expect(rep.toJSON().rejects.map(r => r.reason)).toEqual(['no coordinates', 'no date']);
  });
});
