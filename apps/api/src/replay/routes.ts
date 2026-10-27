import { createHash } from 'node:crypto';
import { DAY_MS, floorTo, HOUR_MS } from '@takip/core/time';
import { isTile, tileBbox } from '@takip/core/tiles';
import { AIRCRAFT_CATEGORIES, isProvisional, LOD_LEVELS, LODS, type Lod, trackClassByName, VESSEL_CATEGORIES } from '@takip/core/tracks';
import type { SqliteCatalogStore } from '@takip/db';
import { type Context, Hono } from 'hono';
import type { AccessEnv } from '../access/middleware';
import type { ReplayData } from './data';
import { featuresRoutes } from './features';
import { historyRoutes } from './history';
import { recordedSpans } from './recorded';
import { seriesRoutes } from './series';

/*
 * /api/replay (replay-database.md §8). Times on the wire are epoch seconds. Sealed chunks never
 * change, so a URL carrying the bucket's version is cached forever; the `p` token keeps cached
 * variants apart per licence policy and lookback, since nginx keys on the URL alone.
 */

const IMMUTABLE = 'public, max-age=31536000, immutable';
const NO_STORE = { 'Cache-Control': 'no-store' };

type Scope = {
  catalog: SqliteCatalogStore;
  sourceIds: ReadonlySet<number>;
  trackMask: number;
  token: string;
  lookbackDays: number;
  windowHours: number;
  /** Nothing older is served to this caller, epoch ms. */
  earliest: number;
};

function scopeOf(c: Context<AccessEnv>, data: ReplayData): Scope | undefined {
  const catalog = data.catalog();
  if (!catalog) return undefined;
  const e = c.var.access.entitlements;
  const policy = catalog.policy(e['data.licence_tier']);
  const lookbackDays = e['replay.lookback_days'];
  return {
    catalog,
    sourceIds: policy.sourceIds,
    trackMask: policy.trackMask,
    token: createHash('sha256').update(`${policy.hash}:${lookbackDays}`).digest('hex').slice(0, 12),
    lookbackDays,
    windowHours: e['replay.window_hours'],
    earliest: floorTo(data.now() - lookbackDays * DAY_MS, HOUR_MS),
  };
}

/** Epoch seconds from a query value; undefined when absent, NaN when not a number. */
const seconds = (v: string | undefined) => (v === undefined || v === '' ? undefined : Number(v));

const notReady = (c: Context) => c.json({ error: 'not_ready', message: 'No replay data yet: the ingest worker has not run.' }, 503, { ...NO_STORE, 'Retry-After': '60' });
const lookbackRequired = (c: Context) =>
  c.json({ error: 'entitlement_required', entitlement: 'replay.lookback_days', upgrade_url: '/pricing' }, 403, NO_STORE);

export function replayRoutes(data: ReplayData) {
  const app = new Hono<AccessEnv>();

  app.get('/manifest', c => {
    const s = scopeOf(c, data);
    if (!s) return notReady(c);
    const now = data.now();
    const toS = seconds(c.req.query('to'));
    const fromS = seconds(c.req.query('from'));
    if (Number.isNaN(toS) || Number.isNaN(fromS)) return c.json({ error: 'bad_time' }, 400, NO_STORE);
    const to = Math.min(toS === undefined ? now : toS * 1000, now);
    // The window entitlement caps how much of the timeline one manifest spans.
    const from = Math.max(fromS === undefined ? to - Math.min(s.windowHours, 24) * HOUR_MS : fromS * 1000, s.earliest, to - s.windowHours * HOUR_MS);

    const lods = LOD_LEVELS.map(lod => {
      const spec = LODS[lod];
      return {
        lod,
        bucketS: spec.bucketMs / 1000,
        fetchZoom: spec.fetchZoom,
        minZoom: spec.minZoom,
        maxZoom: spec.maxZoom,
        // [bucket (s), version, provisional]: a provisional bucket is sealed again, with a new version, once final.
        buckets: s.catalog.sealedBuckets(lod, floorTo(from, spec.bucketMs), to)
          .map(b => [b.bucket / 1000, b.sealedAt, isProvisional(lod, b.bucket, b.sealedAt) ? 1 : 0]),
      };
    });
    const sources = s.catalog.sources().filter(src => s.sourceIds.has(src.sourceId));
    return c.json({
      now: now / 1000,
      from: from / 1000,
      to: to / 1000,
      token: s.token,
      limits: { lookbackDays: s.lookbackDays, windowHours: s.windowHours, earliest: s.earliest / 1000 },
      tracks: {
        url: `/api/replay/tracks/{class}/{lod}/{z}/{x}/{y}/{bucket}.bin?v={v}&p=${s.token}`,
        categories: { vessel: VESSEL_CATEGORIES, aircraft: AIRCRAFT_CATEGORIES },
        lods,
      },
      tle: { url: `/api/replay/tle?at={t}&p=${s.token}` },
      // Spans where a source was down or not recorded are greyed on the timeline; tracks never bridge them.
      coverage: s.catalog.coverage(from, to)
        .filter(cv => sources.some(src => src.code === cv.source))
        .map(cv => ({ source: cv.source, from: cv.tLo / 1000, to: cv.tHi === null ? null : cv.tHi / 1000, status: cv.status })),
      // Over the whole lookback, not just this window: the timeline's track spans it.
      recorded: recordedSpans(s.catalog.coverage(s.earliest, now).filter(cv => sources.some(src => src.code === cv.source)), s.earliest),
      versions: s.catalog.layerVersions(),
      attribution: [...new Set(sources.map(src => src.attribution).filter(Boolean))],
    }, 200, { 'Cache-Control': 'private, max-age=30' });
  });

  app.get('/tracks/:cls/:lod/:z/:x/:y/:file', c => {
    const s = scopeOf(c, data);
    if (!s) return notReady(c);
    const cls = trackClassByName(c.req.param('cls'));
    const lod = Number(c.req.param('lod')) as Lod;
    const [z, x, y] = [c.req.param('z'), c.req.param('x'), c.req.param('y')].map(Number);
    const bucketS = /^(\d+)\.bin$/.exec(c.req.param('file'))?.[1];
    if (!cls || !LOD_LEVELS.includes(lod) || !isTile(z, x, y) || !bucketS) return c.json({ error: 'bad_request' }, 400, NO_STORE);
    const spec = LODS[lod];
    // One tile size per LOD keeps the number of cached variants small.
    if (z !== spec.fetchZoom) return c.json({ error: 'wrong_zoom', fetchZoom: spec.fetchZoom }, 400, NO_STORE);
    const bucket = Number(bucketS) * 1000;
    if (bucket % spec.bucketMs !== 0) return c.json({ error: 'bucket_not_aligned', bucketS: spec.bucketMs / 1000 }, 400, NO_STORE);
    if (c.req.query('p') !== s.token) return c.json({ error: 'policy_mismatch', token: s.token }, 409, NO_STORE);
    if (bucket + spec.bucketMs <= s.earliest) return lookbackRequired(c);

    const sealed = s.catalog.sealedBucket(lod, bucket);
    // The open hour will come from the ingest worker's memory (backend.md §9); until then it is simply not here yet.
    if (!sealed) return c.json({ error: 'not_sealed' }, 404, NO_STORE);
    const body = data.tracks.chunk({ cls, lod, bucket, bbox: tileBbox(z, x, y), allowedMask: s.trackMask });
    const cache = c.req.query('v') === String(sealed.sealedAt) ? IMMUTABLE : 'public, max-age=60';
    return c.body(body as Uint8Array<ArrayBuffer>, 200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': cache });
  });

  app.get('/tle', c => {
    const s = scopeOf(c, data);
    if (!s) return notReady(c);
    if (c.req.query('p') !== s.token) return c.json({ error: 'policy_mismatch', token: s.token }, 409, NO_STORE);
    const now = data.now();
    const atS = seconds(c.req.query('at'));
    if (Number.isNaN(atS)) return c.json({ error: 'bad_time' }, 400, NO_STORE);
    const at = Math.min(atS === undefined ? now : atS * 1000, now);
    if (at < s.earliest) return lookbackRequired(c);
    const tles = data.tracks.tleAt(at).filter(t => s.sourceIds.has(t.sourceId));
    return c.json({
      at: at / 1000,
      count: tles.length,
      tles: tles.map(t => ({ norad: t.noradId, name: t.name, epoch: t.epoch / 1000, line1: t.line1, line2: t.line2 })),
    }, 200, { 'Cache-Control': at < now - DAY_MS ? 'public, max-age=86400' : 'public, max-age=300' });
  });

  app.route('/history', historyRoutes(data));
  app.route('/history/series', seriesRoutes(data));
  app.route('/history/features', featuresRoutes(data));

  return app;
}
