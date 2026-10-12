import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, sourceId } from '../context';
import { utc } from '../dates';
import { EventBatch, resolveCanonical, validLonLat } from '../events';

const DIR = join(RAW_MORE, 'wikidata');
const BATTLES = join(DIR, 'battles.json');
const WORLD_WARS = join(DIR, 'world-wars.json');
const POLITICS = join(DIR, 'politics.json');
const AS_OF = '2026-10-12';

const SIEGE = 'Q188055';
const NAVAL = 'Q1261499';
const COUP = 'Q45382';
/** WAC's canonical world wars, which Wikidata's world-war battles are part of. */
const WAR_PARENT: Record<string, string> = { Q361: 'CNF-0001', Q362: 'CNF-0013' };

/** One row per item from fetch.ts: the first value of each field, times as "<xsd time>/<precision>". */
type Row = Record<string, string | undefined> & { item: string; classes: string };

/** Wikidata time precision: 11 day, 10 month, 9 year, 8 decade, 7 century, 6 millennium. */
const PRECISION: Record<number, Prec> = { 6: Prec.millennium, 7: Prec.century, 8: Prec.decade, 9: Prec.year, 10: Prec.month, 11: Prec.day };

/** RDF times use astronomical years (-0331 is 332 BCE), as utc() does. */
export function wdTime(v: string | undefined): { t: number; prec: Prec } | null {
  const m = v?.match(/^(-?)(\d+)-(\d{2})-(\d{2})T[^/]*\/(\d+)$/);
  if (!m) return null;
  const p = Number(m[5]);
  const prec = p >= 11 ? Prec.day : PRECISION[p];
  if (prec === undefined) return null;
  const year = Number(m[2]) * (m[1] ? -1 : 1);
  if (prec <= Prec.year) return { t: utc(year), prec };
  return { t: utc(year, Number(m[3]), prec === Prec.day ? Number(m[4]) : 1), prec };
}

export function wdPoint(v: string | undefined): { lon: number; lat: number } | null {
  const m = v?.match(/^Point\((-?[\d.]+(?:e-?\d+)?) (-?[\d.]+(?:e-?\d+)?)\)$/i);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  return validLonLat(lon, lat) ? { lon, lat } : null;
}

/** The start: the finer of point in time and start time, which items fill unevenly. */
function start(r: Row, ...fallbacks: (string | undefined)[]) {
  const at = wdTime(r.t);
  const from = wdTime(r.t0);
  if (at && from) return from.prec >= at.prec ? from : at;
  for (const v of [r.t, r.t0, ...fallbacks]) {
    const s = wdTime(v);
    if (s) return s;
  }
  return null;
}

const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const wikiKey = (url: string) => decodeURIComponent(url).split('#')[0].replace(/^https?:\/\//, '').toLowerCase();
const url = (r: Row) => r.article ?? `https://www.wikidata.org/wiki/${r.item}`;
const classes = (r: Row) => new Set(r.classes.split('|'));

/** Wikidata battles and sieges (CC0), 3300 BCE to today. World-war battles join WAC's wars and replace nothing. */
export async function importWikidataBattles(ctx: Ctx) {
  await importDataset(ctx, { source: 'wikidata-battles', version: AS_OF, asOf: AS_OF, files: [BATTLES, WORLD_WARS], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const batch = new EventBatch(ctx, ds);
    const worldWar = new Map(read<{ item: string; war: string }[]>(WORLD_WARS).map(w => [w.item, w.war]));
    const articles = new Map<string, string>();

    for (const r of read<Row[]>(BATTLES)) {
      rep.rows++;
      const label = r.label ?? r.otherLabel;
      if (!label) {
        rep.reject('no label', r.item);
        continue;
      }
      const at = start(r);
      if (!at) {
        rep.reject('no date', r.item);
        continue;
      }
      const own = wdPoint(r.coord);
      const place = own ?? wdPoint(r.locCoord);
      if (!place) {
        rep.reject('no coordinates', r.item);
        continue;
      }
      const end = wdTime(r.t1);
      const cls = classes(r);
      const war = worldWar.get(r.item) ?? r.wars?.split('|').find(w => WAR_PARENT[w]);
      batch.add({
        kind: cls.has(SIEGE) ? 'battle.siege' : 'battle',
        sourceRecordId: r.item,
        title: label,
        tStart: at.t,
        tStartPrec: at.prec,
        tEnd: end && end.t >= at.t ? end.t : null,
        tEndPrec: end && end.t >= at.t ? end.prec : null,
        lon: place.lon,
        lat: place.lat,
        // A battle without its own coordinates is placed at its location item, which may be a region.
        geoPrec: own ? GeoPrec.exact : GeoPrec.area,
        attrs: { description: r.desc ?? null, naval: cls.has(NAVAL) || undefined, war: war ? (war === 'Q361' ? 'World War I' : 'World War II') : undefined, ids: { wikidata: r.item }, url: url(r) },
      });
      if (r.article) articles.set(wikiKey(r.article), r.item);
    }
    const publish = batch.finish();

    const wac = sourceId(ctx, 'wac1914');
    const ww1 = sourceId(ctx, 'ww1-wiki');
    ctx.events.clearRelations(ds.sourceId);
    const n = { part_of: 0, same_as: 0 };
    const ww1Rows = ctx.history.prepare(`SELECT event_id AS id, source_record_id AS url FROM ev_event WHERE source_id = ? AND retracted_at IS NULL`).all(ww1) as { id: number; url: string }[];
    ctx.history.transaction(() => {
      const parents = Object.fromEntries(Object.entries(WAR_PARENT).map(([q, cnf]) => [q, ctx.events.eventId(wac, cnf)]));
      for (const [item, war] of worldWar) {
        const from = batch.has(item) ? ctx.events.eventId(ds.sourceId, item) : undefined;
        const to = parents[war];
        if (from === undefined || to === undefined) continue;
        ctx.events.relate(from, 'part_of', to, 1, ds.sourceId);
        n.part_of++;
      }
      for (const w of ww1Rows) {
        const item = articles.get(wikiKey(w.url));
        const from = item && ctx.events.eventId(ds.sourceId, item);
        if (!from) continue;
        ctx.events.relate(from, 'same_as', w.id, 1, ds.sourceId);
        n.same_as++;
      }
    })();
    const canonical = resolveCanonical(ctx);
    ctx.events.rebuildTimeline(['conflict']);
    rep.extra.links = { ...n, canonical_updated: canonical };
    return publish;
  });
}

/** Wikidata treaties (where they were signed) and coups (at the country's capital unless placed closer); CC0. */
export async function importWikidataPolitics(ctx: Ctx) {
  await importDataset(ctx, { source: 'wikidata-politics', version: AS_OF, asOf: AS_OF, files: [POLITICS], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const batch = new EventBatch(ctx, ds);
    for (const r of read<Row[]>(POLITICS)) {
      rep.rows++;
      const coup = classes(r).has(COUP);
      const label = r.label ?? r.otherLabel;
      if (!label) {
        rep.reject('no label', r.item);
        continue;
      }
      // A treaty's event is its signing (point in time); start and end times are usually when it was in force.
      const at = coup ? start(r) : (wdTime(r.t) ?? wdTime(r.inception) ?? wdTime(r.t0));
      if (!at) {
        rep.reject(`${coup ? 'coup' : 'treaty'}: no date`, r.item);
        continue;
      }
      const capital = wdPoint(r.capital?.split(' ').slice(1).join(' '));
      const own = wdPoint(r.coord);
      const places: [ReturnType<typeof wdPoint>, GeoPrec][] = coup
        ? [[own, GeoPrec.exact], [capital, GeoPrec.city], [wdPoint(r.locCoord), GeoPrec.approximate]]
        : [[own, GeoPrec.exact], [wdPoint(r.signCoord), GeoPrec.city], [wdPoint(r.locCoord), GeoPrec.city]];
      const hit = places.find(([p]) => p);
      if (!hit) {
        rep.reject(`${coup ? 'coup' : 'treaty'}: no place`, r.item);
        continue;
      }
      const [place, geoPrec] = hit as [{ lon: number; lat: number }, GeoPrec];
      const end = coup ? wdTime(r.t1) : null;
      batch.add({
        kind: coup ? 'politics.coup' : 'politics.treaty',
        sourceRecordId: r.item,
        title: label,
        tStart: at.t,
        tStartPrec: at.prec,
        tEnd: end && end.t >= at.t ? end.t : null,
        tEndPrec: end && end.t >= at.t ? end.prec : null,
        lon: place.lon,
        lat: place.lat,
        geoPrec,
        attrs: { description: r.desc ?? null, ids: { wikidata: r.item }, url: url(r) },
      });
    }
    return batch.finish();
  });
}
