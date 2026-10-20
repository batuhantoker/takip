import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type EventInput, GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { num, text } from '../csv';
import { utc } from '../dates';
import { EventBatch, resolveCanonical, validLonLat } from '../events';
import { openXlsx, type Row } from '../xlsx';

const FILE = join(RAW_MORE, 'epica', 'EPICA_v1.1.xlsx');
const AS_OF = '2021-04-26';

type Ev = Omit<EventInput, 'sourceId' | 'datasetId'>;
type Rec = Record<string, string | undefined>;

/** Epicentres placed from intensity data are good to tens of km; past this the point is a guess. */
const VAGUE_KM = 50;
/** A NOAA quake this close, on the same day (or month or year when either knows no more), is the same quake. */
const MATCH_KM = 100;
const DAY = 86_400_000;

/** Sheet rows keyed by the header row. */
export function records(rows: Row[]): Rec[] {
  const head = new Map([...(rows[0]?.cells ?? [])].map(([c, v]) => [c, v.v.trim()]));
  return rows.slice(1).map(r => Object.fromEntries([...head].map(([c, name]) => [name, r.cells.get(c)?.v])));
}

/** Year to minute, at the finest part the catalogue gives. */
export function epicaTime(r: Rec): { t: number; prec: Prec } | null {
  const year = num(r.Year);
  if (year === null) return null;
  const month = num(r.Mo);
  const day = num(r.Da);
  if (month === null || month < 1 || month > 12) return { t: utc(year), prec: Prec.year };
  if (day === null || day < 1 || day > 31) return { t: utc(year, month), prec: Prec.month };
  const hour = num(r.Ho);
  if (hour === null) return { t: utc(year, month, day), prec: Prec.day };
  const minute = num(r.Mi);
  return { t: utc(year, month, day) + (hour * 60 + (minute ?? 0)) * 60_000, prec: minute !== null ? Prec.minute : Prec.hour };
}

/** French sources' areas come in capitals ("HAINAUT (CHARLEROI ?)"). */
const area = (s: string | null) =>
  s && !/\p{Ll}/u.test(s) ? s.toLowerCase().replace(/(^|[\s,(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : s;

export function epicaEvents(recs: Rec[], rep: Reporter): Ev[] {
  const events: Ev[] = [];
  for (const r of recs) {
    rep.rows++;
    const id = text(r.EqID);
    const at = epicaTime(r);
    const lon = num(r.Lon);
    const lat = num(r.Lat);
    if (!id || !at) {
      rep.reject('no id or year', String(r.EqID));
      continue;
    }
    if (!validLonLat(lon, lat)) {
      rep.reject('no epicentre', id);
      continue;
    }
    const unc = Math.max(num(r.LatUnc) ?? 0, num(r.LonUnc) ?? 0) || null;
    const where = area(text(r.Ax));
    events.push({
      kind: 'hazard.quake',
      sourceRecordId: id,
      title: where ? `Earthquake — ${where}` : 'Earthquake',
      tStart: at.t,
      tStartPrec: at.prec,
      lon,
      lat,
      geoPrec: unc !== null && unc > VAGUE_KM ? GeoPrec.approximate : GeoPrec.area,
      magnitude: num(r.Mw),
      attrs: {
        intensity_io: text(r.Io),
        depth_km: num(r.H),
        epicentre_uncertainty_km: unc,
        mw_uncertainty: num(r.MwUnc),
        macroseismic_points: num(r.NMDP),
        data_source: text(r.MDPsSource) ?? text(r.CatSource),
        url: `https://www.emidius.eu/AHEAD/event/${id}`,
      },
    });
  }
  return events;
}

export type Quake = { key: string | number; t: number; prec: number; lon: number; lat: number; mw: number | null };

const km = (a: Quake, b: Quake) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const ym = (t: number) => {
  const d = new Date(t);
  return [d.getUTCFullYear(), d.getUTCMonth()];
};

/**
 * How well two quakes' dates agree, compared at the coarser of their precisions: 0 same day, 1 a day apart (sources
 * split night-time quakes across midnight), 2 same month, 3 same year; null when they disagree.
 */
export function dateTier(a: Quake, b: Quake): number | null {
  const prec = Math.min(a.prec, b.prec);
  const [ya, ma] = ym(a.t);
  const [yb, mb] = ym(b.t);
  if (prec >= Prec.day) {
    const days = Math.abs(Math.floor(a.t / DAY) - Math.floor(b.t / DAY));
    return days <= 1 ? days : null;
  }
  if (ya !== yb) return null;
  if (prec === Prec.month) return ma === mb ? 2 : null;
  return 3;
}

/**
 * Pairs each NOAA quake with at most one EPICA quake and back: the closest date, then (both timed) the closest time,
 * or (coarse dates) the strongest, then the nearest. One-to-one, so a sequence of shocks keeps its other members.
 */
export function matchQuakes(epica: Quake[], noaa: Quake[], maxKm = MATCH_KM): { pairs: [epica: Quake['key'], noaa: Quake['key']][]; candidates: number } {
  const byYear = new Map<number, Quake[]>();
  for (const q of noaa) {
    const y = ym(q.t)[0];
    byYear.set(y, [...(byYear.get(y) ?? []), q]);
  }
  const cands: { e: Quake; n: Quake; score: number[] }[] = [];
  for (const e of epica) {
    const y = ym(e.t)[0];
    for (const n of [...(byYear.get(y - 1) ?? []), ...(byYear.get(y) ?? []), ...(byYear.get(y + 1) ?? [])]) {
      const tier = dateTier(e, n);
      if (tier === null) continue;
      const d = km(e, n);
      if (d > maxKm) continue;
      const timed = e.prec >= Prec.hour && n.prec >= Prec.hour ? Math.abs(e.t - n.t) / 60_000 : 0;
      cands.push({ e, n, score: [tier, tier >= 2 ? -(e.mw ?? 0) : timed, d] });
    }
  }
  cands.sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1] || a.score[2] - b.score[2]);
  const usedE = new Set<Quake['key']>();
  const usedN = new Set<Quake['key']>();
  const pairs: [Quake['key'], Quake['key']][] = [];
  for (const c of cands) {
    if (usedE.has(c.e.key) || usedN.has(c.n.key)) continue;
    usedE.add(c.e.key);
    usedN.add(c.n.key);
    pairs.push([c.e.key, c.n.key]);
  }
  return { pairs, candidates: cands.length };
}

/** same_as from each EPICA quake to the NOAA quake it matches; NOAA stays canonical (CANONICAL_ORDER). */
function linkNoaa(ctx: Ctx, sourceId: number, events: Ev[]) {
  const noaaSource = ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = 'noaa-hazards'`).pluck().get() as number | undefined;
  ctx.events.clearRelations(sourceId);
  if (noaaSource === undefined) return { same_as: 0, candidates: 0, canonical_updated: 0 };
  const noaa = (ctx.history.prepare(`
    SELECT e.event_id AS key, e.t_start AS t, e.t_start_prec AS prec, e.lon, e.lat, e.magnitude AS mw FROM ev_event e JOIN ev_kind k USING (kind_id)
    WHERE k.code = 'hazard.quake' AND e.source_id = ? AND e.t_start >= ? AND e.t_start < ? AND e.lon IS NOT NULL AND e.retracted_at IS NULL
  `).all(noaaSource, utc(990), utc(1910)) as Quake[]);
  const epica = events.map(e => ({ key: e.sourceRecordId, t: e.tStart, prec: e.tStartPrec, lon: e.lon!, lat: e.lat!, mw: e.magnitude ?? null }));
  const { pairs, candidates } = matchQuakes(epica, noaa);
  let sameAs = 0;
  ctx.history.transaction(() => {
    for (const [key, noaaId] of pairs) {
      const from = ctx.events.eventId(sourceId, String(key));
      if (from === undefined) continue;
      ctx.events.relate(from, 'same_as', Number(noaaId), 1, sourceId);
      sameAs++;
    }
  })();
  const canonical = resolveCanonical(ctx);
  ctx.events.rebuildTimeline(['hazard']);
  return { same_as: sameAs, candidates, canonical_updated: canonical };
}

/** EPICA v1.1 (Rovida & Antonucci 2021, INGV, CC BY 4.0): Europe's quakes 1000–1899 with intensity ≥ 5 or Mw ≥ 4. */
export async function importEpica(ctx: Ctx) {
  await importDataset(ctx, { source: 'epica', version: '1.1', asOf: AS_OF, files: [FILE], importerVersion: '1' }, async ds => {
    const events = epicaEvents(records(openXlsx(FILE).rows('EPICA')), ds.report);
    const batch = new EventBatch(ctx, ds);
    for (const e of events) batch.add(e);
    const publish = batch.finish();
    ds.report.extra.links = linkNoaa(ctx, ds.sourceId, events);
    return publish;
  });
}
