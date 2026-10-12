import { bandTolerance, fromWkb, type Geometry, simplify, zband } from '@takip/db';
import { Hono } from 'hono';
import type { AccessEnv } from '../access/middleware';
import type { ReplayData } from './data';
import { boxes } from './history';

/*
 * Time-valid reference layers for History (replay-database.md §8.5), as GeoJSON until feature tiles exist:
 * wartime borders, heritage sites, reservoirs. Each feature is sent whole, simplified for the zoom, so outlines
 * don't show the 256-vertex pieces the index is cut into. Like the rest of /history, gated by licence tier only.
 */

const CACHE = { 'Cache-Control': 'private, max-age=300' };
const NO_STORE = { 'Cache-Control': 'no-store' };
/** Simplified outlines kept per process; a layer has a few hundred features per band. */
const MAX_CACHED = 4000;

type Shape = { geometry: Geometry; props: Record<string, unknown>; t0: number; t1: number | null };

export function featuresRoutes(data: ReplayData) {
  const app = new Hono<AccessEnv>();
  const shapes = new Map<string, Shape | null>();

  /** ?bbox=w,s,e,n&z=&from=&to= (epoch s): the layer's features overlapping the view and window. */
  app.get('/:layer', c => {
    const catalog = data.catalog();
    const found = catalog && data.features(c.req.param('layer'));
    if (!catalog || !found) return c.json({ error: 'not_found' }, 404, NO_STORE);
    const { layer, store } = found;
    if (!catalog.policy(c.var.access.entitlements['data.licence_tier']).sourceIds.has(layer.sourceId)) {
      return c.json({ error: 'not_found' }, 404, NO_STORE);
    }
    const bbox = (c.req.query('bbox') ?? '-180,-90,180,90').split(',').map(Number);
    const z = Math.min(24, Math.max(0, Math.floor(Number(c.req.query('z') ?? 2))));
    const from = c.req.query('from');
    const to = c.req.query('to');
    const tLo = from === undefined ? undefined : Number(from) * 1000;
    const tHi = to === undefined ? undefined : Number(to) * 1000;
    if (bbox.length !== 4 || bbox.some(Number.isNaN) || Number.isNaN(z) || Number.isNaN(tLo) || Number.isNaN(tHi)) {
      return c.json({ error: 'bad_request', message: 'bbox=w,s,e,n, z and from/to in epoch s' }, 400, NO_STORE);
    }

    const zb = zband(z);
    const ids = new Set<number>();
    for (const box of boxes(bbox[0], bbox[1], bbox[2], bbox[3])) for (const p of store.pieces({ bbox: box, z, tLo, tHi })) ids.add(p.featureId);
    const features = [];
    for (const id of ids) {
      const key = `${layer.file}:${id}:${zb}`;
      let shape = shapes.get(key);
      if (shape === undefined) {
        const f = store.feature(id);
        const geometry = f && simplify(fromWkb(f.geom), bandTolerance(zb), true);
        shape = f && geometry ? { geometry, props: f.props, t0: f.validLo, t1: f.validHi } : null;
        if (shapes.size >= MAX_CACHED) shapes.delete(shapes.keys().next().value!);
        shapes.set(key, shape);
      }
      if (!shape) continue;
      const props = { id, ...Object.fromEntries(layer.tileProps.map(k => [k, shape.props[k] ?? null])), t0: shape.t0 / 1000, t1: shape.t1 === null ? null : shape.t1 / 1000 };
      features.push({ type: 'Feature', id, geometry: shape.geometry, properties: props });
      const label = shape.props.label;
      if (Array.isArray(label)) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: label }, properties: { ...props, label: 1 } });
    }
    const source = catalog.sources().find(s => s.sourceId === layer.sourceId);
    return c.json({
      type: 'FeatureCollection',
      layer: { code: layer.code, version: layer.version },
      source: source && { code: source.code, name: source.name, attribution: source.attribution },
      features,
    }, 200, CACHE);
  });

  return app;
}
