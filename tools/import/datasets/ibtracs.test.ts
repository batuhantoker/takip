import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fromWkb } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { Reporter } from '../context';
import { peakOf, stormEvent, storms, stormTitle, unwrap } from './ibtracs';

const HEADER = 'SID,SEASON,BASIN,SUBBASIN,NAME,ISO_TIME,NATURE,LAT,LON,WMO_WIND,WMO_PRES,WMO_AGENCY,TRACK_TYPE,USA_ATCF_ID,USA_WIND,USA_PRES,USA_SSHS,TOKYO_WIND,DS824_WIND';
const UNITS = ' ,Year, , , , , ,degrees_north,degrees_east,kts,mb, , , ,kts,mb,1,kts,kts';
const line = (sid: string, name: string, time: string, lat: number, lon: number, o: { wmo?: number; usa?: number; pres?: number; sshs?: number; tokyo?: number; type?: string; basin?: string } = {}) =>
  [sid, '2013', o.basin ?? 'WP', 'MM', name, time, 'TS', lat, lon, o.wmo ?? ' ', o.pres ?? ' ', o.wmo ? 'tokyo' : ' ', o.type ?? 'main', ' ', o.usa ?? ' ', ' ', o.sshs ?? -5, o.tokyo ?? ' ', ' '].join(',');

async function read(lines: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'ibtracs-'));
  const path = join(dir, 'tracks.csv.gz');
  writeFileSync(path, gzipSync([HEADER, UNITS, ...lines].join('\n')));
  const rep = new Reporter();
  const out = [];
  for await (const s of storms(path, rep)) out.push(s);
  return { out, rep };
}

describe('ibtracs', () => {
  it('names storms by basin and peak wind', () => {
    expect(stormTitle('HAIYAN', 'WP', 170)).toBe('Typhoon Haiyan');
    expect(stormTitle('KATRINA', 'NA', 150)).toBe('Hurricane Katrina');
    expect(stormTitle('FLOSSIE:GRACE', 'EP', 40)).toBe('Tropical storm Flossie / Grace');
    expect(stormTitle('UNNAMED', 'NI', null)).toBe('Unnamed tropical cyclone');
  });

  it('keeps a track continuous across 180°', () => {
    expect(unwrap([178, -179.5, -178])).toEqual([178, 180.5, 182]);
  });

  it('reads one storm per SID, skipping the units row', async () => {
    const { out } = await read([
      line('A', 'ONE', '2013-11-03 00:00:00', 6, 150, { wmo: 30 }),
      line('A', 'ONE', '2013-11-03 03:00:00', 6.5, 149, { wmo: 35 }),
      line('B', 'UNNAMED', '2013-11-04 00:00:00', 10, 80),
    ]);
    expect(out.map(s => [s.sid, s.fixes.length])).toEqual([['A', 2], ['B', 1]]);
  });

  it('places a storm at its strongest US wind, breaking ties on pressure, else lowest pressure, else mid-track', async () => {
    const { out } = await read([
      line('A', 'HAIYAN', '2013-11-06 00:00:00', 7, 140, { usa: 170, wmo: 125, pres: 905, sshs: 5 }),
      line('A', 'HAIYAN', '2013-11-07 00:00:00', 11, 125, { usa: 170, wmo: 125, pres: 895, sshs: 5 }),
      line('A', 'HAIYAN', '2013-11-08 00:00:00', 12, 120, { usa: 150, wmo: 115, pres: 910, sshs: 5 }),
    ]);
    const peak = peakOf(out[0].fixes);
    expect([peak.index, peak.series]).toEqual([1, 'usa']);
    const fixes = out[0].fixes.map(f => ({ ...f, usa: null, wmo: null, other: null }));
    expect(peakOf(fixes).index).toBe(1);
    expect(peakOf(fixes.map(f => ({ ...f, pres: null }))).by).toMatch(/middle/);
  });

  it('stores the track as a line, and the category in attrs', async () => {
    const { out } = await read([
      line('A', 'HAIYAN', '2013-11-06 00:00:00', 7, 140, { usa: 120, sshs: 4 }),
      line('A', 'HAIYAN', '2013-11-06 03:00:00', 8, 138, { usa: 160, sshs: 5 }),
      line('A', 'HAIYAN', '2013-11-06 04:30:00', 8.5, 137, { usa: 155, sshs: 5 }),
      line('A', 'HAIYAN', '2013-11-06 06:00:00', 9, 136, { usa: 150, sshs: 5 }),
      line('A', 'HAIYAN', '2013-11-06 09:00:00', 10, 134, { usa: 140, sshs: 5 }),
    ]);
    const e = stormEvent(out[0]);
    expect([e.title, e.lon, e.lat, e.magnitude]).toEqual(['Typhoon Haiyan', 138, 8, null]);
    expect(e.attrs).toMatchObject({ max_wind_kt: 160, category: 'Category 5', placed_at: expect.stringMatching(/peak intensity/) });
    // The 6-hourly fixes, the peak and the last fix; 04:30 is dropped.
    expect(fromWkb(e.geom!)).toEqual({ type: 'LineString', coordinates: [[140, 7], [138, 8], [136, 9], [134, 10]] });
    expect(e.bbox).toEqual({ w: 134, s: 7, e: 140, n: 10 });
  });

  it('finds a track across 180° by its peak only, at a longitude in range', async () => {
    const { out } = await read([
      line('A', 'X', '2013-11-06 00:00:00', 20, 179, { wmo: 50 }),
      line('A', 'X', '2013-11-06 06:00:00', 21, 181, { wmo: 70 }),
    ]);
    const e = stormEvent(out[0]);
    expect([e.lon, e.bbox, e.attrs!.wind_measured_by]).toEqual([-179, null, 'JMA Tokyo, 10-min sustained']);
  });
});
