import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { Reporter } from '../context';
import { utc } from '../dates';
import { plagueEvents } from './plague';

const row = (Location: string, Year_of_Outbreak: string, lon: string, lat: string, X = '3600000'): Record<string, string> =>
  ({ Location, X_Coord_ERTS89: X, Y_Coord_ERTS89: '3200000', Year_of_Outbreak, Lat_WGS84: lon, Lon_WGS84: lat });

describe('plagueEvents', () => {
  it('reads the swapped columns: Lat_WGS84 is the longitude', () => {
    const [london] = plagueEvents([row('London', '1665', '-0.126296', '51.50016')], new Reporter());
    expect(london).toMatchObject({
      kind: 'disaster.epidemic', sourceRecordId: 'London:1665', title: 'Plague outbreak — London',
      tStart: utc(1665), tStartPrec: Prec.year, lon: -0.126296, lat: 51.50016, geoPrec: GeoPrec.city,
    });
    expect(london.magnitude).toBeUndefined();
  });

  it('rejects shifted, out-of-range and repeated rows', () => {
    const rep = new Reporter();
    const events = plagueEvents([
      // "Eisleben, Lutherstadt" unquoted, as the file has it.
      { Location: 'Eisleben', X_Coord_ERTS89: ' Lutherstadt', Y_Coord_ERTS89: '4428620', Year_of_Outbreak: '2', Lat_WGS84: '1398', Lon_WGS84: '11.550853' },
      row('Sevilla', '9999', '-5.996332', '37.382653'),
      row('Barcelona', '1348', '2.169964', '41.387916'),
      row('Barcelona', '1348', '2.169964', '41.387916'),
      row('Wrong way round', '1500', '41.387916', '2.169964'),
    ], rep);
    expect(events.map(e => e.sourceRecordId)).toEqual(['Barcelona:1348']);
    expect(rep.toJSON().rejects.map(r => [r.reason, r.n])).toEqual([
      ['comma in the town name shifted the columns', 1],
      ['year outside 1347–1900', 1],
      ['town and year listed twice', 1],
      ['point outside Europe and the Mediterranean', 1],
    ]);
    expect(rep.rows).toBe(5);
  });
});
