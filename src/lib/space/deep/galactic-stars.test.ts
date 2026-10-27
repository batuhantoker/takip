import { describe, expect, it } from 'vitest';
import { bvFromBpRp, parseGalacticStars } from './galactic-stars';

function file(sections: { lyPerUnit: number; stars: [number, number, number, number, number][] }[]): ArrayBuffer {
  const total = sections.reduce((n, s) => n + s.stars.length, 0);
  const buf = new ArrayBuffer(8 + sections.length * 8 + total * 8);
  const v = new DataView(buf);
  'GSTR'.split('').forEach((ch, i) => v.setUint8(i, ch.charCodeAt(0)));
  v.setUint32(4, sections.length, true);
  let at = 8;
  for (const s of sections) {
    v.setUint32(at, s.stars.length, true);
    v.setFloat32(at + 4, s.lyPerUnit, true);
    at += 8;
    for (const [x, y, z, abs, bpRp] of s.stars) {
      v.setInt16(at, x, true); v.setInt16(at + 2, y, true); v.setInt16(at + 4, z, true);
      v.setUint8(at + 6, Math.round((abs + 8) * 8)); v.setUint8(at + 7, Math.round((bpRp + 0.5) * 50));
      at += 8;
    }
  }
  return buf;
}

describe('galactic stars', () => {
  it('reads each section at its own scale', () => {
    const s = parseGalacticStars(file([
      { lyPerUnit: 0.5, stars: [[200, -400, 10, 1, 0.82]] },
      { lyPerUnit: 0.25, stars: [[-32767, 0, 4, -3, 2]] },
    ]));
    expect(s.count).toBe(2);
    expect([...s.positions]).toEqual([100, -200, 5, -8191.75, 0, 1]);
    expect(s.absMag[0]).toBe(1);
    expect(s.absMag[1]).toBe(-3);
    expect(s.bv[0]).toBeCloseTo(bvFromBpRp(0.82), 5);
  });

  it('rejects a truncated file', () => {
    const buf = file([{ lyPerUnit: 1, stars: [[1, 2, 3, 0, 1], [4, 5, 6, 0, 1]] }]);
    expect(() => parseGalacticStars(buf.slice(0, buf.byteLength - 8))).toThrow(/bytes/);
  });

  it('gives the Sun its B−V', () => {
    expect(bvFromBpRp(0.82)).toBeCloseTo(0.65, 1);
  });
});
