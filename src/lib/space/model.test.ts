import { describe, expect, it } from 'vitest';
import { norm, sub } from './astro';
import type { FleetCraft } from './fleet';
import type { Vec3 } from './horizons';
import { SpaceModel } from './model';
import type { SkyBody } from './sky';

const body = (key: SkyBody['key'], pos: Vec3, vel: Vec3): SkyBody => ({
  key, name: key, kind: 'planet', color: '#fff', radiusKm: 1, helio: pos, vel,
  states: [{ jd: 0, pos, vel }, { jd: 1, pos: pos.map((p, i) => p + vel[i] * 86_400) as Vec3, vel }],
  track: [],
});

const craft = (over: Partial<FleetCraft>): FleetCraft => ({
  id: -1, name: 'x', cospar: null, agency: null, summary: null, ended: null, region: 'interplanetary',
  helio: [0, 0, 0], vel: [0, 0, 0], sunKm: 0, earthKm: 0, lightSec: 0, speedKmS: 0, speedFrame: 'Sun',
  frame: 'sun', rel: [0, 0, 0], relVel: [0, 0, 0], trail: [], ...over,
});

describe('SpaceModel', () => {
  const m = new SpaceModel();
  m.setSky({ epoch: '', bodies: [body('earth', [1.5e8, 0, 0], [0, 30, 0])] });
  m.fleetEpochJd = 0;

  it('puts the Sun at the origin and interpolates bodies', () => {
    expect(m.bodyPos('sun', 0.5)).toEqual([0, 0, 0]);
    const e = m.bodyPos('earth', 0.5)!;
    expect(e[1]).toBeCloseTo(30 * 43_200, 3);
    expect(m.bodyPos('mars', 0.5)).toBeNull();
  });

  it('carries an L2 craft along with Earth', () => {
    const jwst = craft({ frame: 'earth', rel: [1_500_000, 0, 0], relVel: [0, 0, 0] });
    const at = m.craftPos(jwst, 0.25)!;
    const earth = m.bodyPos('earth', 0.25)!;
    expect(norm(sub(at, earth))).toBeCloseTo(1_500_000, -3);
  });

  it('stops extrapolating a tight orbit after an hour', () => {
    m.setSky({ epoch: '', bodies: [body('earth', [1.5e8, 0, 0], [0, 30, 0]), body('moon', [1.504e8, 0, 0], [0, 31, 0])] });
    const lro = craft({ frame: 'moon', rel: [1_800, 0, 0], relVel: [0, 1.6, 0] });
    const later = m.craftPos(lro, 0.5)!;
    expect(sub(later, m.bodyPos('moon', 0.5)!)).toEqual([1_800, 0, 0]);
  });
});
