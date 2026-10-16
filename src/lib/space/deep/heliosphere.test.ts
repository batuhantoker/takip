import { describe, expect, it } from 'vitest';
import { CROSSINGS, fitHeliosphere, NOSE, shellRadiusAu, TAIL_COS, VOYAGER_DIRECTIONS } from './heliosphere';
import { angleBetween } from '../frames';

describe('heliosphere model', () => {
  const shells = fitHeliosphere();

  it('passes through every Voyager crossing', () => {
    for (const c of CROSSINGS) expect(shellRadiusAu(c.shell, shells[c.shell], VOYAGER_DIRECTIONS[c.craftId])).toBeCloseTo(c.au, 6);
  });

  it('keeps the shock inside the heliopause, both nearest at the nose', () => {
    const ts = shellRadiusAu('termination-shock', shells['termination-shock'], NOSE);
    const hp = shellRadiusAu('heliopause', shells.heliopause, NOSE);
    expect(ts).toBeGreaterThan(70);
    expect(hp).toBeGreaterThan(ts + 15);
    expect(hp).toBeLessThan(125);
    const tail = NOSE.map(x => -x) as [number, number, number];
    expect(shellRadiusAu('heliopause', shells.heliopause, tail)).toBeGreaterThan(hp * 2);
  });

  it('cuts the tail behind the Sun, not at the Voyagers', () => {
    expect(angleBetween(VOYAGER_DIRECTIONS[-31], NOSE)).toBeLessThan(90);
    expect(Math.cos((angleBetween(VOYAGER_DIRECTIONS[-32], NOSE) * Math.PI) / 180)).toBeGreaterThan(TAIL_COS);
  });
});
