import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { Reporter } from '../context';
import { gcatDate, gcatEvents, outcome, parseTsv } from './gcat';

const launch = (r: Partial<Record<string, string>>): Record<string, string> => ({
  Launch_Tag: '1957 ALP', Launch_Date: '1957 Oct  4 1928:34', LV_Type: 'Sputnik 8K71PS', Variant: '-', Flight_ID: 'M1-PS', Flight: 'PS-1',
  Mission: 'PS-1', FlightCode: '-', Platform: '-', Launch_Site: 'NIIP-5', Launch_Pad: 'LC1', Ascent_Site: '-', Ascent_Pad: '-',
  Apogee: '947', Apoflag: '', Agency: 'MVS', LaunchCode: 'OS', Category: 'Sat LEO O 1', ...r,
} as Record<string, string>);

const tables = {
  sites: [
    { Site: 'NIIP-5', StateCode: 'SU', Name: 'Baikonur', Longitude: '63.3', Latitude: '45.9', Error: '0.1000' },
    { Site: 'WI', StateCode: 'US', Name: 'Wallops Island', Longitude: '-75.47', Latitude: '37.84', Error: '0.0200' },
    { Site: 'TRAN', StateCode: 'LUNA', Name: 'Tranquility Base', Longitude: '23.43', Latitude: '0.69', Error: '0.0100' },
    { Site: 'UNKPL', StateCode: 'SU', Name: 'Unknown submarine area', Longitude: '-', Latitude: '-', Error: '-' },
  ],
  pads: [{ Site: 'NIIP-5', Code: 'LC1', Name: 'LC1, Gagarin Start', Longitude: '63.342', Latitude: '45.920', Error: '0.0001' }],
  orgs: [{ Code: 'MVS', Name: 'Ministerstvo', EName: 'Soviet Ministry of Defence' }, { Code: 'NASA', Name: 'NASA', EName: '-' }],
};

describe('gcat', () => {
  it('reads the header and the update date, trimming padded fields', () => {
    const t = parseTsv('#Launch_Tag\tLaunch_Date\n# Updated 2026 Oct 17 1831:51\n1942-A01  \t1942 Jun 13 1052\n');
    expect(t.updated).toBe('2026 Oct 17');
    expect(t.rows).toEqual([{ Launch_Tag: '1942-A01', Launch_Date: '1942 Jun 13 1052' }]);
  });

  it('parses vague dates at their own precision', () => {
    expect(gcatDate('1957 Oct  4 1928:34')).toEqual({ t: Date.UTC(1957, 9, 4, 19, 28, 34), prec: Prec.second, uncertain: false });
    expect(gcatDate('1942 Jun 13 1052')).toMatchObject({ t: Date.UTC(1942, 5, 13, 10, 52), prec: Prec.minute });
    expect(gcatDate('1942 Oct 21')).toMatchObject({ t: Date.UTC(1942, 9, 21), prec: Prec.day });
    expect(gcatDate('1985 May')).toMatchObject({ t: Date.UTC(1985, 4, 1), prec: Prec.month });
    expect(gcatDate('1958 DEc 12')).toMatchObject({ prec: Prec.day });
    expect(gcatDate('1957')).toMatchObject({ prec: Prec.year });
    expect(gcatDate('1959 Sep 22 1010?')).toMatchObject({ prec: Prec.minute, uncertain: true });
    expect(gcatDate('1960 Q2?')).toEqual({ t: Date.UTC(1960, 3, 1), prec: Prec.month, tEnd: Date.UTC(1960, 5, 1), endPrec: Prec.month, uncertain: true });
    expect(gcatDate('1960 Foo 2')).toBeNull();
    expect(gcatDate('1960 Jan 2 2575')).toBeNull();
  });

  it('reads the outcome and the success fraction', () => {
    expect(outcome('OS')).toBe('success');
    expect(outcome('MF')).toBe('failure');
    expect(outcome('ME')).toBe('pad explosion');
    expect(outcome('OS80')).toBe('partial success (80%)');
    expect(outcome('OF40')).toBe('partial failure (40% success)');
    expect(outcome('!')).toBeNull();
  });

  it('places a launch at its pad, names the agency and sorts it by category', () => {
    const rep = new Reporter();
    const [e] = gcatEvents([launch({})], tables, rep);
    expect(e).toMatchObject({ kind: 'space.launch', sourceRecordId: '1957 ALP', title: 'Sputnik 8K71PS — PS-1', lon: 63.342, lat: 45.92, geoPrec: GeoPrec.exact });
    expect(e.attrs).toMatchObject({ outcome: 'success', mission: null, agency: 'Soviet Ministry of Defence', site: 'Baikonur', pad: 'LC1, Gagarin Start', apogee_km: 947, purpose: null });
    expect(e.confidence).toBeUndefined();
    expect(rep.extra.kinds).toEqual({ 'space.launch': 1 });
  });

  it('falls back to the site, by its stated error, and keeps guessed sites hollow', () => {
    const events = gcatEvents([
      launch({ Launch_Tag: '1966-W494', LV_Type: 'Judi-Dart', Flight: '-', Mission: 'WOX-1A', Launch_Site: 'WI', Launch_Pad: '-', LaunchCode: 'SS', Category: 'Aeron', Apogee: '85', Apoflag: '?', Agency: 'NASA' }),
      launch({ Launch_Tag: '1963-A43', LV_Type: 'Atlas F', Launch_Pad: 'LC9', LaunchCode: 'MF', Launch_Date: '1963 Mar 24?' }),
      launch({ Launch_Tag: '1958-A1', LV_Type: 'Jason', Launch_Site: 'WI?', Launch_Pad: '-', LaunchCode: 'HS' }),
    ], tables, new Reporter());
    expect(events.map(e => [e.kind, e.geoPrec])).toEqual([
      ['space.suborbital', GeoPrec.area],
      ['missile.test', GeoPrec.area],
      ['space.suborbital', GeoPrec.approximate],
    ]);
    expect(events[0].title).toBe('Judi-Dart — WOX-1A');
    expect(events[0].attrs).toMatchObject({ apogee_km: '~85', purpose: 'Aeron', agency: 'NASA', pad: null });
    expect(events[1]).toMatchObject({ lon: 63.3, confidence: 0.8, tStartPrec: Prec.day });
    expect(events[2].attrs?.placed_at).toBe('likely launch site, Wallops Island (the source marks it uncertain)');
  });

  it('uses the drop point for an air launch', () => {
    const [e] = gcatEvents([launch({ Launch_Site: 'UNKPL', Launch_Pad: '-', Ascent_Site: 'WI', Ascent_Pad: '-' })], tables, new Reporter());
    expect(e.lon).toBe(-75.47);
  });

  it('rejects entries that are not launches, launches off Earth and sites without coordinates', () => {
    const rep = new Reporter();
    const events = gcatEvents([
      launch({ Launch_Tag: '2014-000', LaunchCode: '!' }),
      launch({ Launch_Tag: '1969-U01', LaunchCode: 'XS', Launch_Site: 'TRAN' }),
      launch({ Launch_Tag: '1990-S1', LaunchCode: 'MS', Launch_Site: 'UNKPL', Launch_Pad: '-' }),
      launch({ Launch_Tag: '1990-S2', Launch_Date: 'soon' }),
    ], tables, rep);
    expect(events).toEqual([]);
    expect(rep.toJSON().rejects.map(r => r.reason)).toEqual(['not a real launch (code !)', 'launched from another world', 'no coordinates for the site', 'unreadable date']);
  });
});
