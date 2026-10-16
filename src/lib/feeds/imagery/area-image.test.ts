import { describe, it, expect } from 'vitest';
import { cropPlan } from './area-image';
import { IMAGERS, type Scene } from './passes';

const TILES = 'https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item=S2&assets=visual&nodata=0&format=png';

const tile = (id: string, w: number, s: number, e: number, n: number, platform = 'sentinel-2a'): Scene => ({
  id, collection: 'sentinel-2-l2a', platform, imager: IMAGERS[platform], time: 0, cloud: 0, tiles: TILES.replace('item=S2', `item=${id}`), preview: null,
  footprint: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
});

describe('cropPlan', () => {
  it('asks each tile for its share of the area at the imager\'s resolution', () => {
    // About 17 × 22 km at 41° N: 10 m pixels.
    const plan = cropPlan([tile('west', 28.9, 40.9, 29.0, 41.1), tile('east', 29.0, 40.9, 29.2, 41.1)], [28.9, 41.0, 29.1, 41.2])!;
    expect(plan.width).toBeGreaterThan(1600);
    expect(plan.width).toBeLessThan(1700);
    const west = plan.pieces.filter(p => p.url.includes('item=west'));
    const east = plan.pieces.filter(p => p.url.includes('item=east'));
    expect(west[0].x).toBe(0);
    expect(west[0].width + east[0].width).toBeGreaterThanOrEqual(plan.width);
    expect(east[0].x + east[0].width).toBe(plan.width);
    // Each tile's pieces stop where the tile does.
    expect(west.reduce((h, p) => h + p.height, 0)).toBeLessThan(plan.height);
    expect(west[0].url).toMatch(/\/item\/bbox\/28\.900000,[\d.]+,29\.000\d+,41\.100\d+\/\d+x\d+\.png\?collection=sentinel-2-l2a&item=west&.*&dst_crs=EPSG:3857$/);
  });

  it('keeps a wide area under the size cap, in chunks that tile it exactly', () => {
    const plan = cropPlan([tile('big', 25, 38, 33, 44)], [26, 39, 32, 43], 2500)!;
    expect(Math.max(plan.width, plan.height)).toBe(2500);
    expect(plan.pieces.length).toBe(Math.ceil(plan.width / 1024) * Math.ceil(plan.height / 1024));
    expect(plan.pieces.reduce((a, p) => a + p.width * p.height, 0)).toBe(plan.width * plan.height);
    for (const p of plan.pieces) expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(1024);
  });

  it('skips a tile outside the area', () => {
    expect(cropPlan([tile('far', 10, 10, 11, 11)], [28.9, 41.0, 29.1, 41.2])).toBeNull();
  });
});
