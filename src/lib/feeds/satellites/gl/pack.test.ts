import { describe, it, expect } from 'vitest';
import { displayElevation, type SatPoint } from '../points';
import { packOrbit, packVertices } from './pack';

const sat = (o: Partial<SatPoint> = {}): SatPoint =>
  ({ lng: 0, lat: 0, altKm: 400, color: 0x00e5ff, size: 1, ...o });

describe('packVertices', () => {
  it('lays out 7 floats per satellite', () => {
    expect(packVertices([sat(), sat(), sat()])).toHaveLength(21);
    expect(packVertices([])).toHaveLength(0);
  });

  it('puts mercator xy in [0,1] for the whole globe', () => {
    const v = packVertices([
      sat({ lng: -180, lat: 85 }),
      sat({ lng: 180, lat: -85 }),
      sat({ lng: 0, lat: 0 }),
    ]);
    for (let i = 0; i < 3; i++) {
      expect(v[i * 7]).toBeGreaterThanOrEqual(0);
      expect(v[i * 7]).toBeLessThanOrEqual(1);
      expect(v[i * 7 + 1]).toBeGreaterThanOrEqual(0);
      expect(v[i * 7 + 1]).toBeLessThanOrEqual(1);
    }
    // Null Island is the middle of the mercator square.
    expect(v[14]).toBeCloseTo(0.5, 6);
    expect(v[15]).toBeCloseTo(0.5, 6);
  });

  it('writes elevation in metres, matching the shader contract', () => {
    const v = packVertices([sat({ altKm: 400 })]);
    expect(v[2] / displayElevation(400)).toBeCloseTo(1, 5);
  });

  it('unpacks colour channels to 0..1 in RGB order', () => {
    const v = packVertices([sat({ color: 0xff8000 })]);
    expect(v[3]).toBeCloseTo(1, 5);
    expect(v[4]).toBeCloseTo(128 / 255, 5);
    expect(v[5]).toBeCloseTo(0, 5);
  });

  it('keeps each satellite in its own slot', () => {
    // An off-by-one in the stride puts every satellite at its neighbour's
    // altitude, which looks plausible and is entirely wrong.
    const v = packVertices([
      sat({ altKm: 400, color: 0xff0000, size: 1 }),
      sat({ altKm: 35786, color: 0x00ff00, size: 2 }),
    ]);
    // Relative comparison: these are float32, which holds ~7 significant
    // digits, so an absolute tolerance at 1e6 magnitude is unmeetable.
    expect(v[2] / displayElevation(400)).toBeCloseTo(1, 5);
    expect(v[6]).toBe(1);
    expect(v[9] / displayElevation(35786)).toBeCloseTo(1, 5);
    expect(v[13]).toBe(2);
    expect(v[10]).toBeCloseTo(0, 5);
    expect(v[11]).toBeCloseTo(1, 5);
  });
});

describe('packOrbit', () => {
  const seg = [
    { lng: 0, lat: 0, altKm: 400 },
    { lng: 10, lat: 5, altKm: 420 },
    { lng: 20, lat: 10, altKm: 440 },
  ];

  it('lays out 3 floats per track point', () => {
    expect(packOrbit(seg)).toHaveLength(9);
    expect(packOrbit([])).toHaveLength(0);
  });

  it('shares the marker contract, so track and satellite land in one space', () => {
    // If these ever diverge the orbit draws beside the satellite instead of
    // through it, which looks like a propagation bug and is not one.
    const marker = packVertices([{ ...seg[0], color: 0, size: 1 }]);
    const track = packOrbit(seg);
    expect(track[0]).toBeCloseTo(marker[0], 6);
    expect(track[1]).toBeCloseTo(marker[1], 6);
    expect(track[2] / marker[2]).toBeCloseTo(1, 5);
  });

  it('follows the altitude along the track, not one flat height', () => {
    const t = packOrbit(seg);
    expect(t[2]).toBeLessThan(t[5]);
    expect(t[5]).toBeLessThan(t[8]);
  });

  it('scales with exaggeration like the markers do', () => {
    expect(packOrbit(seg, 2)[2] / packOrbit(seg, 1)[2]).toBeCloseTo(2, 4);
  });
});
