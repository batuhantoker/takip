import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Geometry, Position, Ring } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { readShapefile } from '../shp';
import { alignment, DIR, fillStatusGaps, labelPoint, reproject, snapshotDate } from './ww2';

const inRing = ([x, y]: Position, ring: Ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const contains = (g: Geometry, p: Position) =>
  (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).some(poly => inRing(p, poly[0]) && !poly.slice(1).some(h => inRing(p, h)));

describe('ww2 borders', () => {
  it('maps the source statuses to five classes', () => {
    expect(alignment('German-occupied')).toBe('occupied');
    expect(alignment('Axis and German, Italian-occupied')).toBe('occupied');
    expect(alignment('Italian Protectorate')).toBe('occupied');
    expect(alignment('Axis-aligned')).toBe('axis');
    expect(alignment('War with Soviet Union')).toBe('axis');
    expect(alignment('Allies')).toBe('allied');
    expect(alignment('Belligerent', 'Germany')).toBe('axis');
    expect(alignment('Belligerent', 'Soviet Union')).toBe('belligerent');
    expect(alignment('Neutral')).toBe('neutral');
    expect(alignment(null)).toBe('none');
  });

  it('fills a one-month blank between equal statuses, and nothing else', () => {
    const runs = [{ status: 'Axis' }, { status: null }, { status: 'Axis' }, { status: null }, { status: 'Allies' }, { status: null }] as { status: string | null }[];
    expect(fillStatusGaps(runs)).toBe(1);
    expect(runs.map(r => r.status)).toEqual(['Axis', 'Axis', 'Axis', null, 'Allies', null]);
  });

    it('reads snapshot dates from file names', () => {
    expect(snapshotDate('June_30_1942')).toBe(Date.UTC(1942, 5, 30));
    expect(snapshotDate('Territorial_Changes')).toBeUndefined();
  });

  it.skipIf(!existsSync(DIR))('reprojects the Albers shapes onto the right places', () => {
    const shapes = readShapefile(join(DIR, 'June_30_1942'));
    const named = (n: string) => reproject(shapes.find(s => s.props.Name === n)!.geometry!);
    expect(contains(named('Germany'), [13.4, 52.52])).toBe(true);
    expect(contains(named('Spain'), [-3.7, 40.42])).toBe(true);
    expect(contains(named('Germany'), [2.35, 48.86])).toBe(false);
    const [lon, lat] = labelPoint(named('Switzerland'));
    expect(lon).toBeGreaterThan(6);
    expect(lon).toBeLessThan(10.5);
    expect(lat).toBeGreaterThan(45.8);
    expect(lat).toBeLessThan(47.8);
  });
});
