import { describe, expect, it } from 'vitest';
import { apparentRaDec, scale, subPoint } from './astro';
import { mul } from './frames';
import type { Vec3 } from './horizons';
import { cameraPosition, equatorialOfDateToGlobe, hiddenByGlobe, invert4, j2000ToLocalSky, raDecVector, toScreen } from './sky-projection';

const EARTH: Vec3 = [1.417680100817214e8, 4.692595488201512e7, -3.327865611620247e3];
const JD = 2461325.5;
const DEG = Math.PI / 180;

/** MapLibre's own sphere point for a longitude and latitude. */
const globePoint = (lat: number, lng: number): Vec3 => [Math.sin(lng * DEG) * Math.cos(lat * DEG), Math.sin(lat * DEG), Math.cos(lng * DEG) * Math.cos(lat * DEG)];

describe('equatorialOfDateToGlobe', () => {
  it('puts the Sun over its sub-solar point on MapLibre’s sphere', () => {
    const { ra, dec } = apparentRaDec(scale(EARTH, -1), JD);
    const p = subPoint(ra, dec, JD);
    const sun = mul(equatorialOfDateToGlobe(JD), raDecVector(ra, dec));
    const want = globePoint(p.lat, p.lng);
    sun.forEach((v, i) => expect(v).toBeCloseTo(want[i], 9));
  });
});

describe('j2000ToLocalSky', () => {
  // Polaris, J2000.
  const polaris = raDecVector(37.95, 89.264);

  it('stands Polaris due north at the observer’s latitude', () => {
    const [x, y, z] = mul(j2000ToLocalSky(JD, 41, 29), polaris);
    // Within its 0.7° circle round the pole.
    expect(Math.abs(Math.atan2(z, Math.hypot(x, y)) / DEG - 41)).toBeLessThan(0.8);
    // y points south on the mercator axes.
    expect(Math.abs(Math.atan2(x, -y) / DEG)).toBeLessThan(1.2);
  });

  it('scales only the up axis', () => {
    const a = mul(j2000ToLocalSky(JD, 41, 29), polaris), b = mul(j2000ToLocalSky(JD, 41, 29, 0.25), polaris);
    expect(b[0]).toBeCloseTo(a[0], 12);
    expect(b[1]).toBeCloseTo(a[1], 12);
    expect(b[2]).toBeCloseTo(a[2] * 0.25, 12);
  });
});

describe('camera geometry', () => {
  // A camera 3 radii out on +z looking at the origin, as a column-major perspective matrix.
  const f = 1 / Math.tan(Math.PI / 8), near = 0.1, far = 10;
  const proj = [f, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
  const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
  const m = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += proj[k * 4 + r] * view[c * 4 + k];

  it('recovers the camera position from the projection', () => {
    const cam = cameraPosition(m)!;
    expect(cam[2]).toBeCloseTo(3, 9);
    expect(Math.hypot(cam[0], cam[1])).toBeLessThan(1e-9);
    expect(invert4(m)).not.toBeNull();
  });

  it('projects the direction away from the camera to the centre of the screen', () => {
    expect(toScreen(m, [0, 0, -1, 0], 800, 600)).toEqual([400, 300]);
    expect(toScreen(m, [0, 0, 1, 0], 800, 600)).toBeNull();
  });

  it('hides what is behind the globe and nothing beside it', () => {
    const cam: Vec3 = [0, 0, 3];
    expect(hiddenByGlobe(cam, [0, 0, -1])).toBe(true);
    expect(hiddenByGlobe(cam, [0.5, 0, -1])).toBe(false);
    expect(hiddenByGlobe(cam, [0, 0, -1], 1.5)).toBe(false);
  });
});
