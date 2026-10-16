import { describe, expect, it } from 'vitest';
import { movePacked, packVertices } from './gl/pack';
import type { SatPoint } from './points';
import { createKeyframes, KEY_STRIDE, keyGap, SAMPLE_STRIDE, sampleKeys, sampleLat, sampleLng, type SatKey, withinReach, writeKey } from './motion';

const key = (t: number, ...sats: ([number, number, number] | null)[]): SatKey => {
  const at = new Float32Array(sats.length * KEY_STRIDE).fill(Number.NaN);
  sats.forEach((s, i) => s && writeKey(at, i, ...s));
  return { t, at };
};
const sample = (a: SatKey, b: SatKey | null, t: number) => {
  const out = new Float32Array((a.at.length / KEY_STRIDE) * SAMPLE_STRIDE);
  sampleKeys(a, b, t, out);
  return out;
};

describe('sampleKeys', () => {
  it('lands exactly where packVertices puts the same position', () => {
    const p: SatPoint = { lng: 37.6, lat: 55.75, altKm: 420, color: 0, size: 1 };
    const packed = packVertices([p]);
    const out = sample(key(0, [p.lng, p.lat, p.altKm]), null, 0);
    expect(out[0]).toBeCloseTo(packed[0], 6);
    expect(out[1]).toBeCloseTo(packed[1], 6);
    expect(sampleLng(out, 0)).toBeCloseTo(37.6, 4);
    expect(sampleLat(out, 0)).toBeCloseTo(55.75, 4);
  });

  it('glides between keyframes, and across the antimeridian the short way', () => {
    const out = sample(key(0, [10, 0, 400], [179, 10, 400]), key(1000, [20, 0, 500], [-179, 10, 400]), 500);
    expect(sampleLng(out, 0)).toBeCloseTo(15, 3);
    expect(out[2]).toBeCloseTo(450, 3);
    expect(Math.abs(sampleLng(out, 1))).toBeGreaterThan(179.9);
  });

  it('goes over a pole rather than around it', () => {
    const out = sample(key(0, [0, 85, 400]), key(1000, [180, 85, 400]), 500);
    expect(sampleLat(out, 0)).toBeGreaterThan(89.9);
  });

  it('steps instead when keyframes are too far apart for the short way to be the way it went', () => {
    const a = key(0, [0, 0, 400]);
    const b = key(1000, [120, 0, 400]);
    expect(sampleLng(sample(a, b, 400), 0)).toBeCloseTo(0, 4);
    expect(sampleLng(sample(a, b, 600), 0)).toBeCloseTo(120, 4);
  });

  it('marks a satellite SGP4 could not place, and takes the other keyframe when only one has it', () => {
    const out = sample(key(0, null, null), key(1000, [5, 5, 400], null), 500);
    expect(sampleLng(out, 0)).toBeCloseTo(5, 4);
    expect(Number.isNaN(out[SAMPLE_STRIDE])).toBe(true);
  });
});

describe('movePacked', () => {
  it('moves positions and keeps colour and size; NaN hides a satellite until it has a position again', () => {
    const points: SatPoint[] = [
      { lng: 0, lat: 0, altKm: 400, color: 0xff0000, size: 2 },
      { lng: 10, lat: 10, altKm: 400, color: 0x00ff00, size: 1 },
    ];
    const packed = packVertices(points);
    const before = packed.slice();
    const to = sample(key(0, [20, 20, 800], null), null, 0);
    movePacked(packed, to);
    expect(packed[0]).toBeCloseTo(to[0], 6);
    expect(packed[2]).toBeGreaterThan(before[2]);
    expect([...packed.slice(3, 7)]).toEqual([...before.slice(3, 7)]);
    expect([...packed.slice(7, 13)]).toEqual([...before.slice(7, 13)]);
    expect(packed[13]).toBe(-1);
    movePacked(packed, sample(key(0, [20, 20, 800], [10, 10, 400]), null, 0));
    expect(packed[13]).toBe(1);
  });
});

describe('withinReach', () => {
  const day = 86_400_000;
  it('draws a low orbit for a week either side of its element set, a high one for a month, and nothing long before', () => {
    expect(withinReach(0, 92, 6 * day)).toBe(true);
    expect(withinReach(0, 92, -8 * day)).toBe(false);
    expect(withinReach(0, 1436, -29 * day)).toBe(true);
    expect(withinReach(0, 1436, 31 * day)).toBe(false);
    expect(withinReach(Date.UTC(2026, 9, 12), 92, Date.UTC(1926, 0, 1))).toBe(false);
  });
});

describe('keyGap', () => {
  it('is a minute of replay time, more at speed, and wider when the worker is slow', () => {
    expect(keyGap(60)).toBe(60_000);
    expect(keyGap(3600)).toBe(180_000);
    expect(keyGap(3600, 80)).toBe(432_000);
  });
});

describe('createKeyframes', () => {
  it('asks for the exact time while paused, and nothing once it has it', () => {
    const keys = createKeyframes();
    expect(keys.next(5000, false, 60, 50)).toEqual({ t: 5000, follows: false });
    keys.add(key(5000), false);
    expect(keys.next(5000, false, 60, 50)).toBeNull();
    expect(keys.next(9000, false, 60, 50)).toEqual({ t: 9000, follows: false });
  });

  it('stays a keyframe ahead while playing, and starts over after a jump', () => {
    const keys = createKeyframes();
    const speed = 60;
    const gap = keyGap(speed, 50);
    const first = keys.next(0, true, speed, 50)!;
    expect(first).toEqual({ t: 3000, follows: false });
    keys.add(key(first.t), first.follows);
    const second = keys.next(1000, true, speed, 50)!;
    expect(second).toEqual({ t: 3000 + gap, follows: true });
    keys.add(key(second.t), second.follows);
    expect(keys.around(3000 + gap / 2)!.map(k => k?.t)).toEqual([3000, 3000 + gap]);
    // Ten seconds of playback back: the keyframes in hand say nothing about there.
    expect(keys.next(3000 - 10 * speed * 1000, true, speed, 50)).toEqual({ t: 3000 - 600_000 + 3000, follows: false });
  });

  it('forgets keyframes the clock has passed', () => {
    const keys = createKeyframes();
    keys.add(key(0), false);
    keys.add(key(100), true);
    keys.add(key(200), true);
    expect(keys.around(150)!.map(k => k?.t)).toEqual([100, 200]);
    expect(keys.around(250)!.map(k => k?.t)).toEqual([200, undefined]);
  });
});
