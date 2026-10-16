import { expand, type Prec } from '@takip/core/time';
import { GeoPrec, type EventInput, type UpsertResult } from '@takip/db';
import type { Ctx, Dataset, Publish } from './context';
import type { Resolver } from './resolver';

const BATCH = 5000;

/**
 * Which source wins when several describe one event (same_as). resolveCanonical recomputes every group
 * at once from the list it is given, so every importer passes this one.
 */
export const CANONICAL_ORDER = [
  'wac1914',
  'cow-interstate',
  'cow-extra',
  'ucdp-brd',
  'wikidata-wars',
  'usgs',
  'noaa-hazards',
  'ww1-wiki',
  'wikidata-battles',
  'ww2-borders',
  'cow-territorial',
];

export function resolveCanonical(ctx: Ctx) {
  const id = ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = ?`).pluck();
  return ctx.events.resolveCanonical(CANONICAL_ORDER.map(code => id.get(code) as number | undefined).filter((s): s is number => s !== undefined));
}

export const validLonLat = (lon: number | null, lat: number | null) =>
  lon !== null && lat !== null && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 && !(lon === 0 && lat === 0);

/** The event's own point when it has one, else the midpoint of the given polities, marked country precision. */
export function anchor(r: Resolver, lon: number | null, lat: number | null, prec: GeoPrec, fallback: (number | undefined)[]) {
  if (validLonLat(lon, lat)) return { lon: lon!, lat: lat!, geoPrec: prec };
  const p = r.midpoint(fallback);
  return p ? { lon: p.lon, lat: p.lat, geoPrec: GeoPrec.country } : { lon: null, lat: null, geoPrec: GeoPrec.none };
}

/**
 * Buffers events for one source and writes them in batches. finish() retracts what this version dropped,
 * rebuilds the timeline bins and returns the publish options.
 */
export class EventBatch {
  private buf: EventInput[] = [];
  private keys = new Set<string>();
  readonly totals: UpsertResult = { inserted: 0, changed: 0, unchanged: 0 };
  tLo = Infinity;
  tHi = -Infinity;
  families = new Set<string>();

  constructor(private readonly ctx: Ctx, private readonly ds: Dataset, readonly sourceId = ds.sourceId) {}

  add(e: Omit<EventInput, 'sourceId' | 'datasetId'>) {
    if (this.keys.has(e.sourceRecordId)) throw new Error(`duplicate source_record_id ${e.sourceRecordId}`);
    this.keys.add(e.sourceRecordId);
    if (e.lon === null || e.lat === null) this.ds.report.reject('no anchor (not drawable)', e.sourceRecordId);
    this.buf.push({ ...e, sourceId: this.sourceId, datasetId: this.ds.datasetId });
    this.tLo = Math.min(this.tLo, e.tStart);
    const last = e.tEnd ?? e.tStart;
    this.tHi = Math.max(this.tHi, expand(last, (e.tEnd != null ? (e.tEndPrec ?? e.tStartPrec) : e.tStartPrec) as Prec).hi);
    this.families.add(this.ctx.events.family(e.kind));
    if (this.buf.length >= BATCH) this.flush();
  }

  flush() {
    if (!this.buf.length) return;
    const r = this.ctx.events.upsertEvents(this.buf);
    this.totals.inserted += r.inserted;
    this.totals.changed += r.changed;
    this.totals.unchanged += r.unchanged;
    this.buf = [];
  }

  has(key: string) {
    return this.keys.has(key);
  }

  finish(): Publish {
    this.flush();
    const retracted = this.ctx.events.retractMissing(this.sourceId, this.keys);
    const families = [...this.families];
    this.ctx.events.rebuildTimeline(families);
    this.ds.report.extra[`events:${this.sourceId}`] = { ...this.totals, retracted };
    return {
      tLo: Number.isFinite(this.tLo) ? this.tLo : null,
      tHi: Number.isFinite(this.tHi) ? this.tHi : null,
      layers: families.map(f => `events:${f}`),
    };
  }
}
