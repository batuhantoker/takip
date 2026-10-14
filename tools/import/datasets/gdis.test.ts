import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { Reporter } from '../context';
import { cleanName, gdisEvents, middle } from './gdis';

const row = (r: Partial<Record<string, string>>): Record<string, string> => ({
  id: '1', country: 'Albania', iso3: 'ALB', gwno: '339', year: '2009', geo_id: '1', geolocation: 'Shkoder', level: '1',
  adm1: 'Shkoder', adm2: 'NA', adm3: 'NA', location: 'Shkoder', historical: '0', hist_country: 'NA',
  disastertype: 'flood', disasterno: '2009-0631', latitude: '42.1', longitude: '19.6', ...r,
} as Record<string, string>);

describe('gdis', () => {
  it('groups places by disaster and country, at their middle, with the count as magnitude', () => {
    const rep = new Reporter();
    const { events } = gdisEvents([
      row({ geolocation: 'Ana E Malit', level: '3', adm1: 'Shkoder', latitude: '42.0', longitude: '19.4' }),
      row({ geolocation: 'Bushat', level: '3', adm1: 'Shkoder', latitude: '42.0', longitude: '19.6' }),
      row({ geolocation: 'Bushat', level: '3', adm1: 'Shkoder', latitude: '42.0001', longitude: '19.6001' }),
    ], rep);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.title).toBe('Flood — Shkoder, Albania');
    expect(e.kind).toBe('disaster.flood');
    expect(e.tStartPrec).toBe(Prec.year);
    expect(e.magnitude).toBe(2);
    expect(e.lon).toBeCloseTo(19.5);
    expect(e.geoPrec).toBe(GeoPrec.area);
    expect(e.attrs).toMatchObject({ where: ['Ana E Malit', 'Bushat'], region: ['Shkoder'], also_hit: [], disaster_no: '2009-0631' });
    expect(rep.rows).toBe(3);
  });

  it('links the countries of one disaster, spans its years and trims the type', () => {
    const { events, links } = gdisEvents([
      row({ disastertype: 'extreme temperature ', country: 'Serbia', year: '2012' }),
      row({ disastertype: 'extreme temperature ', country: 'Kosovo', year: '2012', geolocation: 'Prishtine', adm1: 'Prishtine' }),
      row({ disastertype: 'extreme temperature ', country: 'Kosovo', year: '2013', geolocation: 'Peje', adm1: 'Peje' }),
    ], new Reporter());
    expect(events.map(e => e.sourceRecordId)).toEqual(['2009-0631:Serbia', '2009-0631:Kosovo']);
    expect(links).toEqual([['2009-0631:Serbia', '2009-0631:Kosovo']]);
    const kosovo = events[1];
    expect(kosovo.kind).toBe('disaster.temperature');
    expect([new Date(kosovo.tStart).getUTCFullYear(), new Date(kosovo.tEnd!).getUTCFullYear()]).toEqual([2012, 2013]);
    expect(kosovo.title).toBe('Extreme temperature — Kosovo');
    expect(kosovo.attrs?.also_hit).toEqual(['Serbia']);
  });

  it('fixes centroids GDIS averaged across 180° and keeps the middle on the right side', () => {
    const { events } = gdisEvents([
      row({ country: 'Fiji', geolocation: 'Lau', adm1: 'Eastern', level: '2', latitude: '-18.3', longitude: '-114.01' }),
      row({ country: 'Fiji', geolocation: 'Macuata', adm1: 'Northern', level: '2', latitude: '-16.5', longitude: '179.29' }),
    ], new Reporter());
    expect(events[0].attrs?.places_at).toEqual([[-178.8, -18.32], [179.29, -16.5]]);
    expect(Math.abs(events[0].lon!)).toBeGreaterThan(179);
    expect(events[0].geoPrec).toBe(GeoPrec.area);
    expect(middle([[179, 0], [-179, 0]])[0]).toBeCloseTo(180);
    expect(middle([[10, 0], [20, 10]])).toEqual([15, 5]);
  });

  it('repairs double-encoded names and rejects unknown types', () => {
    expect(cleanName('StÅ\u0093Ng Treng')).toBe('StœNg Treng');
    expect(cleanName('Anse A  Pitre')).toBe('Anse A Pitre');
    const rep = new Reporter();
    expect(gdisEvents([row({ disastertype: 'wildfire' })], rep).events).toHaveLength(0);
    expect(rep.toJSON().rejects[0].reason).toBe('type wildfire');
  });
});
