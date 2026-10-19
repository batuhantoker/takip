import { type DataLayout, type Db, fromWkb, geoLayers, type Geometry, type Position, SqliteFeatureStore } from '@takip/db';

export type LayerFeature = { sourceRecordId: string | null; props: Record<string, unknown>; geom: Geometry };

/** Every feature of a reference layer's current version, whole; undefined when the layer hasn't been built. */
export function layerFeatures(layout: DataLayout, catalog: Db, code: string): LayerFeature[] | undefined {
  const layer = geoLayers(catalog).find(l => l.code === code);
  const store = layer && SqliteFeatureStore.open(layout, layer);
  if (!store) return undefined;
  try {
    const rows = store.db.prepare(`SELECT source_record_id AS sourceRecordId, props, geom FROM feature`).all() as { sourceRecordId: string | null; props: string; geom: Uint8Array }[];
    return rows.map(r => ({ sourceRecordId: r.sourceRecordId, props: JSON.parse(r.props) as Record<string, unknown>, geom: fromWkb(r.geom) }));
  } finally {
    store.close();
  }
}

const insideRing = ([x, y]: Position, ring: Position[]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

function polygons(g: Geometry): Position[][][] {
  if (g.type === 'Polygon') return [g.coordinates as Position[][]];
  if (g.type === 'MultiPolygon') return g.coordinates as Position[][][];
  return [];
}

/** Which of a polygon layer's features a point is in, as its props; a 1° grid of boxes keeps it to a few ring tests. */
export function polygonLocator<P>(features: LayerFeature[]): (at: Position) => P | undefined {
  const grid = new Map<string, { props: P; polys: Position[][][]; box: [number, number, number, number] }[]>();
  for (const f of features) {
    const polys = polygons(f.geom);
    const xs = polys.flatMap(p => p[0].map(c => c[0]));
    const ys = polys.flatMap(p => p[0].map(c => c[1]));
    const box: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const entry = { props: f.props as P, polys, box };
    for (let x = Math.floor(box[0]); x <= Math.floor(box[2]); x++) {
      for (let y = Math.floor(box[1]); y <= Math.floor(box[3]); y++) grid.set(`${x},${y}`, [...(grid.get(`${x},${y}`) ?? []), entry]);
    }
  }
  return at => grid.get(`${Math.floor(at[0])},${Math.floor(at[1])}`)?.find(({ polys, box }) =>
    at[0] >= box[0] && at[0] <= box[2] && at[1] >= box[1] && at[1] <= box[3]
    && polys.some(([outer, ...holes]) => insideRing(at, outer) && !holes.some(h => insideRing(at, h))))?.props;
}
