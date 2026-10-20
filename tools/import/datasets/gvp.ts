import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expand, Prec } from '@takip/core/time';
import { type EventInput, GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { astronomical, type Stated, ymd } from '../dates';
import { EventBatch, resolveCanonical, validLonLat } from '../events';
import { articleFiles, Articles, km } from '../articles';

export const GVP_FILE = join(RAW_MORE, 'gvp', 'holocene-eruptions.json');
/** fetch.ts `noaa`: NCEI's eruptions carry GVP volcano numbers, which the links match on. */
const NOAA_VOLCANOES = join(RAW_MORE, 'noaa', 'volcanoes.json');
const AS_OF = '2026-10-20';

const DAY = 86_400_000;
/** NCEI dates the deadly moment and GVP the onset, so a month either side is still the same eruption. */
const SLACK = 31 * DAY;
/** A longer eruption keeps its own dot, and NCEI's events inside it become its parts. */
const SHORT = 366 * DAY;
/** An NCEI eruption without a GVP number GVP knows matches volcanoes this close. */
const NEAR_KM = 25;
/** NCEI eruptions GVP dates months apart: Vesuvius 79 is Pliny's 24 August in NCEI, the 24 October of later finds in GVP. */
const SAME: Record<string, string> = { 'vo:1348': 'er:10050' };

export type GvpProps = {
  Volcano_Number: number;
  Volcano_Name: string;
  Eruption_Number: number;
  Activity_Type: string;
  ExplosivityIndexMax: number | null;
  ExplosivityIndexModifier: string | null;
  ActivityArea: string | null;
  ActivityUnit: string | null;
  StartEvidenceMethod: string | null;
  StartDateYearModifier: string | null;
  StartDateYear: number | null;
  StartDateYearUncertainty: number | null;
  StartDateMonth: number | null;
  StartDateDay: number | null;
  StartDateDayUncertainty: number | null;
  EndDateYear: number | null;
  EndDateYearUncertainty: number | null;
  EndDateMonth: number | null;
  EndDateDay: number | null;
  EndDateDayUncertainty: number | null;
};
export type GvpFeature = { geometry: { coordinates: number[] } | null; properties: GvpProps };
export type GvpEvent = Omit<EventInput, 'sourceId' | 'datasetId'>;
type Item = Record<string, unknown>;

/**
 * A GVP date at the precision it has. GVP fills unknown parts with a midpoint and a ± in days (year-only is 2 July
 * ± 182, month-only the 16th ± 15), and a ± in years coarsens it further.
 */
export function gvpDate(year: number | null, month: number | null, day: number | null, dayUnc: number | null, yearUnc: number | null = null): Stated | null {
  if (year === null) return null;
  const spread = dayUnc ?? 0;
  const at = ymd(astronomical(year), spread >= 180 ? null : month, spread >= 14 ? null : day);
  if (!at || !yearUnc) return at;
  const cap = yearUnc >= 500 ? Prec.millennium : yearUnc >= 50 ? Prec.century : yearUnc >= 5 ? Prec.decade : Prec.year;
  return { t: at.t, prec: Math.min(at.prec, cap) as Prec };
}

const YEAR_MODIFIER: Record<string, string> = { '?': 'year uncertain', '<': 'before', '>': 'after' };

/** "Fournaise, Piton de la" → "Piton de la Fournaise"; "Sawad, Harra Es-" → "Harra Es-Sawad". */
export const uninvert = (name: string) => name.replace(/^(.+), (.+)$/, (_, a: string, b: string) => (b.endsWith('-') ? b + a : `${b} ${a}`));

const pointOf = (f: GvpFeature) => {
  const [lon, lat] = f.geometry?.coordinates ?? [];
  return validLonLat(lon ?? null, lat ?? null) ? { lon, lat } : null;
};

export function gvpEvents(features: GvpFeature[], rep: Reporter, articles: Articles | null = null): GvpEvent[] {
  const out: GvpEvent[] = [];
  for (const f of features) {
    rep.rows++;
    const p = f.properties;
    const at = pointOf(f);
    const start = gvpDate(p.StartDateYear, p.StartDateMonth, p.StartDateDay, p.StartDateDayUncertainty, p.StartDateYearUncertainty);
    if (!at || !start) {
      rep.reject(at ? 'no start year' : 'no point', String(p.Eruption_Number));
      continue;
    }
    const end = gvpDate(p.EndDateYear, p.EndDateMonth, p.EndDateDay, p.EndDateDayUncertainty, p.EndDateYearUncertainty);
    const ends = end !== null && end.t > start.t;
    const uncertain = p.Activity_Type !== 'Confirmed Eruption';
    if (uncertain) rep.sentinel('uncertain eruption → confidence 0.5');
    if (start.prec < Prec.year) rep.sentinel('start ± ≥ 5 years → decade or coarser');
    const dating = [p.StartDateYearModifier && YEAR_MODIFIER[p.StartDateYearModifier], p.StartDateYearUncertainty ? `± ${p.StartDateYearUncertainty} years` : null];
    out.push({
      kind: 'hazard.volcano',
      sourceRecordId: `er:${p.Eruption_Number}`,
      title: `${uncertain ? 'Uncertain eruption' : 'Eruption'} of ${uninvert(p.Volcano_Name)}`,
      tStart: start.t,
      tStartPrec: start.prec,
      tEnd: ends ? end.t : null,
      tEndPrec: ends ? end.prec : null,
      ...at,
      geoPrec: GeoPrec.exact,
      confidence: uncertain ? 0.5 : 1,
      attrs: {
        // VEI stays out of magnitude: the hazard family's magnitude is a quake's, sized and labelled as such.
        vei: p.ExplosivityIndexMax,
        uncertain: uncertain || null,
        date_uncertainty: dating.filter(Boolean).join(', ') || null,
        vent: p.ActivityArea,
        unit: p.ActivityUnit,
        dated_by: p.StartEvidenceMethod,
        volcano_number: p.Volcano_Number,
        eruption_number: p.Eruption_Number,
        vei_modifier: p.ExplosivityIndexModifier,
        url: `https://volcano.si.edu/volcano.cfm?vn=${p.Volcano_Number}&vtab=Eruptions`,
        wiki: articles?.event(['eruption'], start.t, start.prec, at, 100) ?? articles?.volcano(p.Volcano_Number) ?? null,
      },
    });
  }
  return out;
}

type Window = { key: string; volcano: number; lo: number; hi: number; long: boolean; confirmed: boolean };

/** When an eruption ran, ± years ignored; with no end date, to the end of its start year. */
function windowOf(p: GvpProps): Window | null {
  const s = gvpDate(p.StartDateYear, p.StartDateMonth, p.StartDateDay, p.StartDateDayUncertainty);
  if (!s) return null;
  const e = gvpDate(p.EndDateYear, p.EndDateMonth, p.EndDateDay, p.EndDateDayUncertainty);
  const start = expand(s.t, s.prec);
  const endHi = e ? Math.max(start.hi, expand(e.t, e.prec).hi) : start.hi;
  return {
    key: `er:${p.Eruption_Number}`,
    volcano: p.Volcano_Number,
    lo: start.lo,
    hi: e ? endHi : expand(s.t, Prec.year).hi,
    long: endHi - start.lo > SHORT,
    confirmed: p.Activity_Type === 'Confirmed Eruption',
  };
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export type LinkPlan = { sameAs: [gvp: string, noaa: string][]; partOf: [noaa: string, gvp: string][]; byPlace: number; noNumber: number; unmatched: string[] };

/**
 * NCEI's eruptions against GVP's, by GVP volcano number (or, without one GVP knows, a volcano within 25 km) and an
 * overlapping date. An eruption that matched one NCEI row and lasted at most a year is `same_as` it. Several
 * rows, or a longer eruption, make each row `part_of` it, so no NCEI event disappears into another's dot.
 */
export function planNoaaLinks(features: GvpFeature[], noaa: Item[]): LinkPlan {
  const windows = new Map<number, Window[]>();
  const byKey = new Map<string, Window>();
  const volcanoAt = new Map<number, { lon: number; lat: number }>();
  for (const f of features) {
    const w = windowOf(f.properties);
    const at = pointOf(f);
    if (!w || !at) continue;
    windows.set(w.volcano, [...(windows.get(w.volcano) ?? []), w]);
    byKey.set(w.key, w);
    volcanoAt.set(w.volcano, at);
  }
  const plan: LinkPlan = { sameAs: [], partOf: [], byPlace: 0, noNumber: 0, unmatched: [] };
  const hits = new Map<string, string[]>();
  for (const v of noaa) {
    const year = n(v.year);
    if (year === null) continue;
    const at = ymd(astronomical(year), n(v.month), n(v.day));
    if (!at) continue;
    const span = expand(at.t, at.prec);
    const known = windows.get(n(v.volcanoLocationNewNum) ?? -1);
    let candidates = known ?? [];
    if (!known) {
      plan.noNumber++;
      const lon = n(v.longitude);
      const lat = n(v.latitude);
      if (lon !== null && lat !== null) {
        const near = [...volcanoAt].filter(([, p]) => km(p, { lon, lat }) <= NEAR_KM).map(([id]) => id);
        candidates = near.flatMap(id => windows.get(id) ?? []);
      }
    }
    const id = `vo:${v.id}`;
    // The latest eruption already under way, else the first to start just after.
    const best = byKey.get(SAME[id]) ?? candidates
      .filter(w => span.lo < w.hi + SLACK && span.hi > w.lo - SLACK)
      .map(w => ({ w, began: w.lo < span.hi }))
      .sort((a, b) => Number(b.began) - Number(a.began) || (a.began ? b.w.lo - a.w.lo : a.w.lo - b.w.lo) || Number(b.w.confirmed) - Number(a.w.confirmed))[0]?.w;
    if (!best) {
      plan.unmatched.push(id);
      continue;
    }
    if (!known) plan.byPlace++;
    hits.set(best.key, [...(hits.get(best.key) ?? []), id]);
  }
  for (const [key, rows] of hits) {
    if (rows.length === 1 && !byKey.get(key)!.long) plan.sameAs.push([key, rows[0]]);
    else for (const r of rows) plan.partOf.push([r, key]);
  }
  return plan;
}

/** Writes the plan's relations for the events both sources hold, then recomputes canonical events. */
function linkNoaa(ctx: Ctx, sourceId: number, plan: LinkPlan | null) {
  ctx.events.clearRelations(sourceId);
  const noaa = ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = 'noaa-hazards'`).pluck().get() as number | undefined;
  let sameAs = 0;
  let partOf = 0;
  let missing = 0;
  if (plan && noaa !== undefined) {
    const pair = (gvpKey: string, noaaKey: string) => {
      const g = ctx.events.eventId(sourceId, gvpKey);
      const o = ctx.events.eventId(noaa, noaaKey);
      if (g === undefined || o === undefined) missing++;
      return g === undefined || o === undefined ? null : { g, o };
    };
    ctx.history.transaction(() => {
      for (const [g, o] of plan.sameAs) {
        const ids = pair(g, o);
        if (!ids) continue;
        ctx.events.relate(ids.g, 'same_as', ids.o, 1, sourceId);
        sameAs++;
      }
      for (const [o, g] of plan.partOf) {
        const ids = pair(g, o);
        if (!ids) continue;
        ctx.events.relate(ids.o, 'part_of', ids.g, 1, sourceId);
        partOf++;
      }
    })();
  }
  const canonical = resolveCanonical(ctx);
  ctx.events.rebuildTimeline(['hazard']);
  return {
    same_as: sameAs,
    part_of: partOf,
    noaa_matched_by_place: plan?.byPlace ?? 0,
    noaa_without_known_gvp_number: plan?.noNumber ?? 0,
    noaa_unmatched: plan?.unmatched.length ?? 0,
    noaa_unmatched_sample: plan?.unmatched.slice(0, 10) ?? [],
    events_not_loaded: missing,
    canonical_updated: canonical,
  };
}

/**
 * Smithsonian GVP Volcanoes of the World: every Holocene eruption, confirmed or uncertain, at its volcano. NCEI's
 * significant eruptions (noaa-hazards, imported first) win as the canonical event when both hold one.
 */
export async function importGvp(ctx: Ctx) {
  const noaaFile = existsSync(NOAA_VOLCANOES) ? [NOAA_VOLCANOES] : [];
  await importDataset(ctx, { source: 'gvp-eruptions', version: AS_OF, asOf: AS_OF, files: [GVP_FILE, ...noaaFile, ...articleFiles()], importerVersion: '1' }, async ds => {
    const features = (JSON.parse(readFileSync(GVP_FILE, 'utf8')) as { features: GvpFeature[] }).features;
    const batch = new EventBatch(ctx, ds);
    for (const e of gvpEvents(features, ds.report, Articles.read())) batch.add(e);
    const publish = batch.finish();
    const plan = noaaFile.length ? planNoaaLinks(features, JSON.parse(readFileSync(NOAA_VOLCANOES, 'utf8')) as Item[]) : null;
    ds.report.extra.links = linkNoaa(ctx, ds.sourceId, plan);
    return publish;
  });
}
