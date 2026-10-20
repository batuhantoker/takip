import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { Reporter } from '../context';
import { fireballEvents } from './fireballs';

const fields = ['date', 'energy', 'impact-e', 'lat', 'lat-dir', 'lon', 'lon-dir', 'alt', 'vel'];

describe('fireballs', () => {
  it('signs the hemispheres, keeps the energies and rejects rows without a place', () => {
    const rep = new Reporter();
    const events = fireballEvents({
      fetched: '2026-10-20',
      fields,
      data: [
        ['2013-02-15 03:20:26', '37500', '441', '54.8', 'N', '61.1', 'E', '23.3', '18.6'],
        ['2026-10-04 03:14:45', '5.4', '0.18', '41.8', 'S', '173.1', 'W', '26.9', null],
        ['2024-08-20 12:53:51', '6.0', '0.19', null, null, null, null, null, null],
      ],
    }, rep);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: 'hazard.fireball', sourceRecordId: '2013-02-15 03:20:26', title: 'Fireball (441 kt)', tStart: Date.UTC(2013, 1, 15, 3, 20, 26),
      tStartPrec: Prec.second, lon: 61.1, lat: 54.8, geoPrec: GeoPrec.exact,
    });
    expect(events[0].attrs).toMatchObject({ impact_energy_kt: 441, radiated_energy_gj: 375000, altitude_km: 23.3, velocity_km_s: 18.6 });
    expect([events[1].lon, events[1].lat]).toEqual([-173.1, -41.8]);
    expect(events[1].attrs?.velocity_km_s).toBeNull();
    expect(rep.toJSON()).toMatchObject({ rows: 3, rejects: [{ reason: 'no location', n: 1 }] });
  });
});
