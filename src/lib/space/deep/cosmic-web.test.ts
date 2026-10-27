import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASINS, NEARBY_VOIDS } from './basins.generated';
import { bootesIndex, filamentSegments, NEARBY_VOID_NAMES, parseBasins, parseCosmicWeb, type BasinMesh } from './cosmic-web';

const buf = readFileSync('public/data/cosmos/web.bin');
const web = parseCosmicWeb(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('cosmic web', () => {
  it('reads every void, filament and point', () => {
    const by = (c: string) => web.voids.filter(v => v.catalogue === c).length;
    expect(by('sdss')).toBeGreaterThan(400);
    expect(by('network')).toBe(27);
    expect(by('quaia')).toBeGreaterThan(3_000);
    expect(web.filamentPoints.length).toBe(15_421);
    expect(web.filamentPoints.reduce((a, b) => a + b, 0)).toBe(web.points.length / 3);
  });

  it('gives each void three nearly square axes and a believable size', () => {
    for (const v of web.voids.filter(x => x.catalogue === 'sdss')) {
      const [a, b, c] = v.axes;
      const n = (x: number[]) => Math.hypot(x[0], x[1], x[2]);
      expect(Math.abs(dot(a, b)) / (n(a) * n(b))).toBeLessThan(0.05);
      expect(Math.abs(dot(b, c)) / (n(b) * n(c))).toBeLessThan(0.05);
      expect(v.reffMly).toBeGreaterThan(20);
      expect(v.reffMly).toBeLessThan(400);
    }
  });

  it('draws one segment fewer than points for each filament', () => {
    const segs = filamentSegments(web).length / 6;
    expect(segs).toBe(web.points.length / 3 - web.filamentPoints.length);
  });

  it('finds Boötes among the catalogued voids', () => {
    expect(bootesIndex(web.voids)).toBeGreaterThanOrEqual(0);
  });
});

describe('far and all-sky voids', () => {
  it('puts the supervoids billions of light-years out, over both hemispheres', () => {
    const quaia = web.voids.filter(v => v.catalogue === 'quaia');
    const d = quaia.map(v => Math.hypot(...v.centre));
    expect(Math.min(...d)).toBeGreaterThan(7_000);
    expect(Math.max(...d)).toBeLessThan(25_000);
    expect(quaia.some(v => v.centre[2] < 0) && quaia.some(v => v.centre[2] > 0)).toBe(true);
  });

  it('covers the southern sky near us, where SDSS does not reach', () => {
    expect(web.voids.some(v => v.catalogue === 'network' && v.centre[2] < -100)).toBe(true);
  });
});

describe('nearest voids', () => {
  const local = web.voids.filter(v => v.catalogue === 'local');

  it('reads all 25, each with a name', () => {
    expect(local.map(v => v.nearby)).toEqual([...Array(25).keys()]);
    expect(NEARBY_VOIDS.every(v => NEARBY_VOID_NAMES[v.name])).toBe(true);
  });

  it('keeps them within about 90 million light-years, around us on every side', () => {
    for (const v of local) expect(Math.hypot(...v.centre)).toBeLessThan(90);
    expect(local.some(v => v.centre[2] < -20) && local.some(v => v.centre[2] > 20)).toBe(true);
  });

  it('puts the Hercules void toward Hercules', () => {
    const her = local[NEARBY_VOIDS.findIndex(v => v.name === 'Her')];
    const [x, y, z] = her.centre, r = Math.hypot(x, y, z);
    expect((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360).toBeCloseTo(249, 0);
    expect((Math.asin(z / r) * 180) / Math.PI).toBeCloseTo(20, 0);
  });
});

describe('Cosmicflows-4 basins', () => {
  const b = readFileSync('public/data/cosmos/basins.bin');
  const { meshes, flows } = parseBasins(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const lan = BASINS.findIndex(x => x.id === 'laniakea');

  // Odd crossings of a ray mean inside a closed surface.
  function inside(m: BasinMesh, p: number[]): boolean {
    const d = [0.5773, 0.5774, 0.5773];
    let hits = 0;
    for (let i = 0; i < m.indices.length; i += 3) {
      const [a, b2, c] = [0, 1, 2].map(k => Array.from(m.positions.subarray(m.indices[i + k] * 3, m.indices[i + k] * 3 + 3)));
      const e1 = a.map((v, k) => b2[k] - v), e2 = a.map((v, k) => c[k] - v);
      const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
      const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
      if (Math.abs(det) < 1e-9) continue;
      const s = p.map((v, k) => v - a[k]);
      const u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
      if (u < 0 || u > 1) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
      const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
      if (v < 0 || u + v > 1) continue;
      if ((e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 0) hits++;
    }
    return hits % 2 === 1;
  }

  it('has one closed mesh for each basin', () => {
    expect(meshes.length).toBe(BASINS.length);
    for (const m of meshes) {
      expect(Math.max(...m.indices)).toBeLessThan(m.positions.length / 3);
      // Every edge of a closed surface is shared by two triangles, or four where two sheets touch at a corner.
      const edges = new Map<string, number>();
      for (let i = 0; i < m.indices.length; i += 3) for (let k = 0; k < 3; k++) {
        const a = m.indices[i + k], c = m.indices[i + ((k + 1) % 3)];
        const key = a < c ? `${a},${c}` : `${c},${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      expect([...edges.values()].every(n => n % 2 === 0)).toBe(true);
    }
  });

  it('puts the Sun inside Laniakea and outside the others', () => {
    expect(inside(meshes[lan], [0, 0, 0])).toBe(true);
    meshes.forEach((m, i) => { if (i !== lan) expect(inside(m, [0, 0, 0])).toBe(false); });
  });

  it('holds each attractor inside its own basin', () => {
    BASINS.forEach((x, i) => expect(inside(meshes[i], x.core)).toBe(true));
  });

  it('runs each streamline inside its basin, ending near its attractor', () => {
    expect(flows.points.length / 3).toBe(flows.counts.reduce((a, c) => a + c, 0));
    let o = 0, near = 0;
    flows.counts.forEach((c, i) => {
      const b = BASINS[flows.basin[i]], m = meshes[flows.basin[i]];
      const first = Array.from(flows.points.subarray(o * 3, o * 3 + 3)), last = Array.from(flows.points.subarray((o + c - 1) * 3, (o + c) * 3));
      // Toward an attractor the line ends at it; from a repeller it starts there.
      const end = b.kind === 'attraction' ? last : first;
      if (Math.hypot(...end.map((v, k) => v - b.core[k])) < 150) near++;
      if (i % 17 === 0) expect(inside(m, Array.from(flows.points.subarray((o + (c >> 1)) * 3, (o + (c >> 1)) * 3 + 3)))).toBe(true);
      o += c;
    });
    expect(near / flows.counts.length).toBeGreaterThan(0.8);
  });

  it('flows Laniakea toward the Great Attractor', () => {
    const [x, y, z] = BASINS[lan].core, r = Math.hypot(x, y, z);
    expect((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360).toBeCloseTo(263, 0);
    expect((Math.asin(z / r) * 180) / Math.PI).toBeCloseTo(-39, 0);
  });
});
