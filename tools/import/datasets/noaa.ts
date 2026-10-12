import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { utc } from '../dates';
import { EventBatch, resolveCanonical, validLonLat } from '../events';

const DIR = join(RAW_MORE, 'noaa');
const FILES = { quakes: join(DIR, 'earthquakes.json'), tsunamis: join(DIR, 'tsunamis.json'), volcanoes: join(DIR, 'volcanoes.json') };
const AS_OF = '2026-10-12';

/** Instrumental epicentres start about here; earlier ones are macroseismic estimates. */
const INSTRUMENTAL = 1900;
/** A USGS quake this close in time and space is the same quake. */
const MATCH_S = 120;
const MATCH_KM = 150;
/** NCEI tsunami validity: 4 definite, 3 probable, 2 questionable; 1 very doubtful, 0 seiche, -1 erroneous are dropped. */
const VALIDITY_CONFIDENCE: Record<number, number> = { 4: 1, 3: 0.8, 2: 0.5 };

type Item = Record<string, string | number | boolean | undefined>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Year to second, at the finest part NCEI gives. */
export function nceiTime(i: Item): { t: number; prec: Prec } | null {
  const year = n(i.year);
  if (year === null) return null;
  const month = n(i.month);
  const day = n(i.day);
  if (month === null) return { t: utc(year), prec: Prec.year };
  if (day === null) return { t: utc(year, month), prec: Prec.month };
  const base = utc(year, month, day);
  const hour = n(i.hour);
  if (hour === null) return { t: base, prec: Prec.day };
  const minute = n(i.minute);
  const second = n(i.second);
  const t = base + ((hour * 60 + (minute ?? 0)) * 60 + Math.floor(second ?? 0)) * 1000;
  return { t, prec: second !== null ? Prec.second : minute !== null ? Prec.minute : Prec.hour };
}

const title = (s: unknown) =>
  String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|[\s,:(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** Deaths, injuries, damage and houses, preferring the totals that include secondary effects (tsunami, fire). */
function impact(i: Item) {
  return {
    deaths: n(i.deathsTotal) ?? n(i.deaths),
    injuries: n(i.injuriesTotal) ?? n(i.injuries),
    missing: n(i.missingTotal) ?? n(i.missing),
    damage_musd: n(i.damageMillionsDollarsTotal) ?? n(i.damageMillionsDollars),
    houses_destroyed: n(i.housesDestroyedTotal) ?? n(i.housesDestroyed),
  };
}

/** NCEI's order-of-magnitude codes (1 = 1–50 deaths … 4 = over 1,000) as a 0–1 severity, for sorting and sizing. */
const severity = (i: Item) => {
  const o = Math.max(n(i.deathsAmountOrderTotal) ?? n(i.deathsAmountOrder) ?? 0, n(i.damageAmountOrderTotal) ?? n(i.damageAmountOrder) ?? 0);
  return o ? o / 4 : null;
};

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Item[];

function rejectNoTime(rep: Reporter, kind: string, i: Item) {
  rep.reject(`${kind}: no year`, String(i.id));
}

/** NCEI significant earthquakes, tsunami events and volcanic eruptions (public domain), from 2150 BCE. */
export async function importNoaa(ctx: Ctx) {
  await importDataset(ctx, { source: 'noaa-hazards', version: AS_OF, asOf: AS_OF, files: Object.values(FILES), importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const batch = new EventBatch(ctx, ds);
    const links: [from: string, to: string][] = [];

    for (const q of read(FILES.quakes)) {
      rep.rows++;
      const at = nceiTime(q);
      if (!at) {
        rejectNoTime(rep, 'quake', q);
        continue;
      }
      const lon = n(q.longitude);
      const lat = n(q.latitude);
      const ok = validLonLat(lon, lat);
      const year = new Date(at.t).getUTCFullYear();
      batch.add({
        kind: 'hazard.quake',
        sourceRecordId: `eq:${q.id}`,
        title: `Earthquake — ${title(q.locationName)}`,
        tStart: at.t,
        tStartPrec: at.prec,
        lon: ok ? lon : null,
        lat: ok ? lat : null,
        geoPrec: ok ? (year >= INSTRUMENTAL ? GeoPrec.exact : GeoPrec.area) : GeoPrec.none,
        magnitude: n(q.eqMagnitude),
        severity: severity(q),
        attrs: { ...impact(q), intensity_mmi: n(q.intensity), depth_km: n(q.eqDepth), country: title(q.country), url: `https://www.ngdc.noaa.gov/hazel/view/hazards/earthquake/event-more-info/${q.id}` },
      });
      if (q.tsunamiEventId) links.push([`eq:${q.id}`, `ts:${q.tsunamiEventId}`]);
      if (q.volcanoEventId) links.push([`eq:${q.id}`, `vo:${q.volcanoEventId}`]);
    }

    for (const s of read(FILES.tsunamis)) {
      rep.rows++;
      const confidence = VALIDITY_CONFIDENCE[n(s.eventValidity) ?? -1];
      if (confidence === undefined) {
        rep.reject(`tsunami: validity ${s.eventValidity}`, String(s.id));
        continue;
      }
      const at = nceiTime(s);
      if (!at) {
        rejectNoTime(rep, 'tsunami', s);
        continue;
      }
      const lon = n(s.longitude);
      const lat = n(s.latitude);
      const ok = validLonLat(lon, lat);
      batch.add({
        kind: 'hazard.tsunami',
        sourceRecordId: `ts:${s.id}`,
        title: `Tsunami — ${title(s.locationName ?? s.country)}`,
        tStart: at.t,
        tStartPrec: at.prec,
        lon: ok ? lon : null,
        lat: ok ? lat : null,
        geoPrec: ok ? GeoPrec.area : GeoPrec.none,
        severity: severity(s),
        confidence,
        attrs: { ...impact(s), max_water_height_m: n(s.maxWaterHeight), source_quake_magnitude: n(s.eqMagnitude), runups: n(s.numRunups), url: `https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/${s.id}` },
      });
      if (s.volcanoEventId) links.push([`ts:${s.id}`, `vo:${s.volcanoEventId}`]);
    }

    for (const v of read(FILES.volcanoes)) {
      rep.rows++;
      const at = nceiTime(v);
      if (!at) {
        rejectNoTime(rep, 'volcano', v);
        continue;
      }
      const lon = n(v.longitude);
      const lat = n(v.latitude);
      const ok = validLonLat(lon, lat);
      batch.add({
        kind: 'hazard.volcano',
        sourceRecordId: `vo:${v.id}`,
        title: `Eruption of ${v.name}`,
        tStart: at.t,
        tStartPrec: at.prec,
        lon: ok ? lon : null,
        lat: ok ? lat : null,
        geoPrec: ok ? GeoPrec.exact : GeoPrec.none,
        severity: severity(v),
        attrs: { vei: n(v.vei), ...impact(v), volcano_type: v.morphology ?? null, country: v.country ?? null, url: `https://www.ngdc.noaa.gov/hazel/view/hazards/volcano/event-more-info/${v.id}` },
      });
    }

    const publish = batch.finish();
    ctx.events.clearRelations(ds.sourceId);
    let related = 0;
    ctx.history.transaction(() => {
      for (const [a, b] of links) {
        const from = ctx.events.eventId(ds.sourceId, a);
        const to = ctx.events.eventId(ds.sourceId, b);
        if (from === undefined || to === undefined) continue;
        ctx.events.relate(from, 'related', to, 1, ds.sourceId);
        related++;
      }
    })();
    rep.extra.links = { related, ...linkUsgsQuakes(ctx, ds.sourceId) };
    return publish;
  });
}

const km = (lon1: number, lat1: number, lon2: number, lat2: number) => {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};

/**
 * same_as from each instrumental NCEI quake to the USGS quake it matches, so a quake the ingest worker
 * also recorded shows once (USGS wins). Re-run after `ingest backfill usgs` by re-importing with --force.
 */
export function linkUsgsQuakes(ctx: Ctx, noaaSourceId: number) {
  const usgs = ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = 'usgs'`).pluck().get() as number | undefined;
  if (usgs === undefined) return { same_as: 0, canonical_updated: 0 };
  const quakes = ctx.history.prepare(`
    SELECT e.event_id AS id, e.t_start AS t, e.lon, e.lat FROM ev_event e JOIN ev_kind k USING (kind_id)
    WHERE k.code = 'hazard.quake' AND e.source_id = ? AND e.t_start_prec >= ? AND e.lon IS NOT NULL AND e.retracted_at IS NULL
  `).all(noaaSourceId, Prec.minute) as { id: number; t: number; lon: number; lat: number }[];
  const near = ctx.history.prepare(`
    SELECT e.event_id AS id, e.lon, e.lat FROM ev_event e
    WHERE e.kind_id = (SELECT kind_id FROM ev_kind WHERE code = 'hazard.quake') AND e.source_id = ?
      AND e.t_lo BETWEEN ? AND ? AND e.lon IS NOT NULL AND e.retracted_at IS NULL
  `);
  let sameAs = 0;
  ctx.history.transaction(() => {
    for (const q of quakes) {
      if (new Date(q.t).getUTCFullYear() < INSTRUMENTAL) continue;
      const hits = (near.all(usgs, q.t - MATCH_S * 1000, q.t + MATCH_S * 1000) as { id: number; lon: number; lat: number }[])
        .map(h => ({ ...h, d: km(q.lon, q.lat, h.lon, h.lat) }))
        .filter(h => h.d <= MATCH_KM)
        .sort((a, b) => a.d - b.d);
      if (!hits.length) continue;
      ctx.events.relate(q.id, 'same_as', hits[0].id, 1, noaaSourceId);
      sameAs++;
    }
  })();
  const canonical = resolveCanonical(ctx);
  ctx.events.rebuildTimeline(['hazard']);
  return { same_as: sameAs, canonical_updated: canonical };
}
