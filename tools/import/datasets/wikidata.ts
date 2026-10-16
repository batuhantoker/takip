import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, sourceId } from '../context';
import { utc } from '../dates';
import { EventBatch, resolveCanonical, validLonLat } from '../events';
import { enwikiTitle, otherArticle } from '../wiki';

export const DIR = join(RAW_MORE, 'wikidata');
export const BATTLES = join(DIR, 'battles.json');
const WORLD_WARS = join(DIR, 'world-wars.json');
export const POLITICS = join(DIR, 'politics.json');
export const ATTACKS = join(DIR, 'attacks.json');
/** fetch.ts `war-battles`: WAC and COW wars' Wikidata items, and the battles under them. */
export const WAR_BATTLES = join(DIR, 'war-battles.json');
/** fetch.ts `sitelinks`: other Wikipedias' articles for items with no English one. */
const SITELINKS = join(DIR, 'sitelinks.json');
const AS_OF = '2026-10-12';

const SIEGE = 'Q188055';
const NAVAL = 'Q1261499';
const COUP = 'Q45382';
/** WAC's canonical world wars, which Wikidata's world-war battles are part of. */
export const WAR_PARENT: Record<string, string> = { Q361: 'CNF-0001', Q362: 'CNF-0013' };
/** Their years, a year either side: Wikidata's part-of chains reach earlier battles too (an 1825 one under World War II). */
const WAR_YEARS: Record<string, [number, number]> = { Q361: [1913, 1919], Q362: [1938, 1946] };
const YEAR_MS = 365.25 * 86_400_000;

/**
 * Items that describe the same battle as another item, checked by hand: duplicate → the one kept (with the
 * Wikipedia article where only one has it). Most same-title, same-year pairs are different battles (two
 * Battles of Cedar Creek in 1864, the November and December sieges of Carlisle in 1745), so this is no rule.
 */
export const DUPLICATES: Record<string, string> = {
  Q141224971: 'Q129567174', // Battle of Bonilla, 26 vs 28 Nov 1868
  Q19984564: 'Q139261257', // Battle of Cumae, 524 BCE
  Q2984784: 'Q3206342', // Battle of Günzburg, 1805
  Q4871562: 'Q85745869', // Battle of Lindley's Fort, 1776
  Q68809773: 'Q3400101', // Battle of Mametz Wood, 1916
  Q124364378: 'Q16531735', // Battle of Montichiari, 1420
  Q3297508: 'Q6889422', // Battle of Philippeville / Philippeville massacre, 1955
  Q9173643: 'Q4872587', // Battle of Treiden, 1628
  Q115940294: 'Q2890309', // Battle of Vertou, 1793
  Q13732805: 'Q27628425', // Capture of Delfzijl, 1591: siege start vs capture
  Q5759430: 'Q85760415', // Fall of Phnom Penh, 1975: siege vs fall
  Q59559767: 'Q68972231', // Sinking of HMS Sheffield, 1982
  Q97178906: 'Q20009178', // Siege of Eryx, 277/276 BCE
  Q77094950: 'Q120848718', // Siege of Landau, 1704
  Q111014828: 'Q20962413', // Siege of Pamplona, 1874–75
  Q16683533: 'Q85801098', // Siege of Perinthus, 340 BCE
  Q136218904: 'Q4337448', // Siege of Smolensk, 1654
  Q18008728: 'Q104903169', // Siege of Tortosa, 808–809
  Q1401325: 'Q113540587', // Siege of Valpovo, 1543
  Q66628423: 'Q5723209', // Battle of Vega Real, 1495
  Q653293: 'Q128619743', // Siege of Antioch, 1084–85
  Q118929878: 'Q119167274', // Battle of Patras, 1466
  Q61072729: 'Q3485863', // Siege of Constantinople, 1394–1402
};

/**
 * Dates from each item's Wikipedia article (en, else pl/be/it) for World War II battles that Wikidata dates only
 * by year, so the WW2 play doesn't show them from 1 January. Used only while Wikidata stays at year precision.
 */
export const DATES: Record<string, [start: string, end?: string]> = {
  Q11795063: ['1939-09-13', '1939-09-16'], // Siege of Sochaczew
  Q24948781: ['1939-09-01'], // Shelling of Bytom
  Q3087703: ['1939-09-06', '1939-09-08'], // Battle of Łódź
  Q2005006: ['1939-09', '1945-05'], // Baltic Sea campaigns: invasion of Poland to the surrender
  Q11154422: ['1940-03-02', '1940-03-13'], // Battle of Vyborg Bay
  Q96195581: ['1941-06', '1941-07'], // Battle (defence) of Minsk
  Q12375607: ['1941-07-03', '1941-10-21'], // Summer War
  Q29026260: ['1941-09'], // Battle of Tuulos
  Q16331929: ['1943-03-04', '1943-03-06'], // Battle of Fardykambos
  Q4859251: ['1944-03-05', '1944-09-24'], // Battle of Romania
  Q9172312: ['1944-04-25', '1944-04-26'], // Action of 26 April 1944
  Q15178082: ['1944-11-01'], // Action of 1 November 1944
  Q3636687: ['1945-02-22', '1945-05-02'], // Battles of Mortirolo, both
  Q96373237: ['1945-03-25', '1945-04-03'], // Battle of Aschaffenburg
  Q9370600: ['1945-04-24', '1945-05-05'], // Battles for Wilhelmshaven
};

export function isoDate(s: string): { t: number; prec: Prec } {
  const [y, m, d] = s.split('-').map(Number);
  return d ? { t: utc(y, m, d), prec: Prec.day } : { t: utc(y, m), prec: Prec.month };
}

/** One row per item from fetch.ts: the first value of each field, times as "<xsd time>/<precision>". */
export type Row = Record<string, string | undefined> & { item: string; classes: string };

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
export function start(r: Row, ...fallbacks: (string | undefined)[]) {
  const at = wdTime(r.t);
  const from = wdTime(r.t0);
  if (at && from) return from.prec >= at.prec ? from : at;
  for (const v of [r.t, r.t0, ...fallbacks]) {
    const s = wdTime(v);
    if (s) return s;
  }
  return null;
}

export const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const wikiKey = (url: string) => decodeURIComponent(url).split('#')[0].replace(/^https?:\/\//, '').toLowerCase();
export const url = (r: Row) => r.article ?? `https://www.wikidata.org/wiki/${r.item}`;
export const sitelinkFiles = () => (existsSync(SITELINKS) ? [SITELINKS] : []);
export const readSitelinks = () => (existsSync(SITELINKS) ? read<Record<string, Record<string, string>>>(SITELINKS) : {});
export const classes = (r: Row) => new Set(r.classes.split('|'));

/** Wikidata battles and sieges (CC0), 3300 BCE to today. World-war battles join WAC's wars and replace nothing. */
export async function importWikidataBattles(ctx: Ctx) {
  await importDataset(ctx, { source: 'wikidata-battles', version: AS_OF, asOf: AS_OF, files: [BATTLES, WORLD_WARS, ...(existsSync(WAR_BATTLES) ? [WAR_BATTLES] : []), ...sitelinkFiles()], importerVersion: '6' }, async ds => {
    const rep = ds.report;
    const sitelinks = readSitelinks();
    const batch = new EventBatch(ctx, ds);
    const worldWar = new Map(read<{ item: string; war: string }[]>(WORLD_WARS).map(w => [w.item, w.war]));
    const articles = new Map<string, string>();
    const rows = read<Row[]>(BATTLES);
    const items = new Set(rows.map(r => r.item));

    for (const r of rows) {
      rep.rows++;
      const kept = DUPLICATES[r.item];
      if (kept && items.has(kept)) {
        rep.reject('duplicate of another item (DUPLICATES)', `${r.item} → ${kept}`);
        continue;
      }
      const label = r.label ?? r.otherLabel;
      if (!label) {
        rep.reject('no label', r.item);
        continue;
      }
      const stated = start(r);
      if (!stated) {
        rep.reject('no date', r.item);
        continue;
      }
      const own = wdPoint(r.coord);
      const place = own ?? wdPoint(r.locCoord);
      if (!place) {
        rep.reject('no coordinates', r.item);
        continue;
      }
      const fix = stated.prec <= Prec.year ? DATES[r.item] : undefined;
      if (fix) rep.sentinel('year-only date → DATES');
      const at = fix ? isoDate(fix[0]) : stated;
      const end = fix ? (fix[1] ? isoDate(fix[1]) : null) : wdTime(r.t1);
      const cls = classes(r);
      const named = worldWar.get(r.item) ?? r.wars?.split('|').find(w => WAR_PARENT[w]);
      const year = new Date(at.t).getUTCFullYear();
      const war = named && year >= WAR_YEARS[named][0] && year <= WAR_YEARS[named][1] ? named : undefined;
      if (named && !war) rep.sentinel('world war battle outside the war years → not linked');
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
        attrs: {
          description: r.desc ?? null,
          naval: cls.has(NAVAL) || undefined,
          war: war ? (war === 'Q361' ? 'World War I' : 'World War II') : undefined,
          ids: { wikidata: r.item },
          url: url(r),
          wiki: enwikiTitle(r.article) ?? otherArticle(sitelinks[r.item]),
        },
      });
      if (r.article) articles.set(wikiKey(r.article), r.item);
    }
    const publish = batch.finish();

    const wac = sourceId(ctx, 'wac1914');
    const ww1 = sourceId(ctx, 'ww1-wiki');
    ctx.events.clearRelations(ds.sourceId);
    const n = { part_of: 0, same_as: 0 };
    const ww1Rows = ctx.history.prepare(`SELECT event_id AS id, source_record_id AS url FROM ev_event WHERE source_id = ? AND retracted_at IS NULL`).all(ww1) as { id: number; url: string }[];
    const during = duringWar(ctx);
    ctx.history.transaction(() => {
      const parents = Object.fromEntries(Object.entries(WAR_PARENT).map(([q, cnf]) => [q, ctx.events.eventId(wac, cnf)]));
      for (const [item, war] of worldWar) {
        const from = batch.has(item) ? ctx.events.eventId(ds.sourceId, item) : undefined;
        const to = parents[war];
        if (from === undefined || to === undefined || !during(from, to)) continue;
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
    const wars = linkWars(ctx, ds.sourceId, batch);
    ctx.events.rebuildTimeline(['conflict']);
    rep.extra.links = { ...n, wars, canonical_updated: canonical };
    return publish;
  });
}

/** Whether a battle starts within a war, a year either side; an ongoing war has a far-off t_hi. */
export function duringWar(ctx: Ctx) {
  const at = ctx.history.prepare(`SELECT t_start AS t, t_lo AS lo, t_hi AS hi FROM ev_event WHERE event_id = ?`);
  return (battle: number, war: number) => {
    const b = at.get(battle) as { t: number } | undefined;
    const w = at.get(war) as { lo: number; hi: number } | undefined;
    return !!b && !!w && b.t >= w.lo - YEAR_MS && b.t <= w.hi + YEAR_MS;
  };
}

/**
 * part_of from each battle to the WAC or COW wars Wikidata puts it under, between canonical events so a war's
 * popup lists them. The World Wars are linked above, from world-wars.json.
 */
function linkWars(ctx: Ctx, battles: number, batch: EventBatch) {
  if (!existsSync(WAR_BATTLES)) return 'skipped: run `fetch.ts war-battles`';
  const { wars, battles: links } = read<{ wars: { key: string; qid: string }[]; battles: { war: string; item: string }[] }>(WAR_BATTLES);
  const sources: Record<string, number[]> = { wac1914: [sourceId(ctx, 'wac1914')], cow: [sourceId(ctx, 'cow-interstate'), sourceId(ctx, 'cow-extra')] };
  const canonical = ctx.history.prepare(`SELECT coalesce(canonical_id, event_id) FROM ev_event WHERE event_id = ? AND retracted_at IS NULL`).pluck();
  const warEvent = new Map<string, number>();
  for (const { key, qid } of wars) {
    if (WAR_PARENT[qid] || warEvent.has(qid)) continue;
    const [table, record] = key.split(':');
    const id = sources[table]?.map(s => ctx.events.eventId(s, record)).find(e => e !== undefined);
    const top = id === undefined ? undefined : (canonical.get(id) as number | undefined);
    if (top !== undefined) warEvent.set(qid, top);
  }
  const during = duringWar(ctx);
  const linked = new Set<string>();
  ctx.history.transaction(() => {
    for (const { war, item } of links) {
      const to = warEvent.get(war);
      const own = to !== undefined && batch.has(item) ? ctx.events.eventId(battles, item) : undefined;
      const from = own === undefined ? undefined : (canonical.get(own) as number | undefined);
      if (to === undefined || from === undefined || from === to || !during(from, to)) continue;
      ctx.events.relate(from, 'part_of', to, 1, battles);
      linked.add(`${from}>${to}`);
    }
  })();
  return { part_of: linked.size, wars: new Set(links.map(l => warEvent.get(l.war)).filter(w => w !== undefined)).size };
}

/** Wikidata treaties (where they were signed) and coups (at the country's capital unless placed closer); CC0. */
export async function importWikidataPolitics(ctx: Ctx) {
  await importDataset(ctx, { source: 'wikidata-politics', version: AS_OF, asOf: AS_OF, files: [POLITICS, ...sitelinkFiles()], importerVersion: '3' }, async ds => {
    const rep = ds.report;
    const sitelinks = readSitelinks();
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
        attrs: { description: r.desc ?? null, ids: { wikidata: r.item }, url: url(r), wiki: enwikiTitle(r.article) ?? otherArticle(sitelinks[r.item]) },
      });
    }
    return batch.finish();
  });
}

/** GTD's years: Wikidata's attacks from then are GTD's too, and its popups find their articles by day and place. */
const GTD_YEARS = [1970, 2017];

/** Wikidata terrorist attacks (CC0) from outside GTD's years: before 1970 and since 2018. */
export async function importWikidataAttacks(ctx: Ctx) {
  await importDataset(ctx, { source: 'wikidata-attacks', version: AS_OF, asOf: AS_OF, files: [ATTACKS, ...sitelinkFiles()], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const batch = new EventBatch(ctx, ds);
    const sitelinks = readSitelinks();
    for (const r of read<Row[]>(ATTACKS)) {
      rep.rows++;
      const label = r.label ?? r.otherLabel;
      const at = start(r);
      if (!label || !at) {
        rep.reject(label ? 'no date' : 'no label', r.item);
        continue;
      }
      const year = new Date(at.t).getUTCFullYear();
      if (year >= GTD_YEARS[0] && year <= GTD_YEARS[1]) {
        rep.reject('in GTD years (GTD has it)', r.item);
        continue;
      }
      const own = wdPoint(r.coord);
      const place = own ?? wdPoint(r.locCoord);
      if (!place) {
        rep.reject('no coordinates', r.item);
        continue;
      }
      const end = wdTime(r.t1);
      const deaths = Number(r.deaths);
      const injured = Number(r.injured);
      batch.add({
        kind: 'attack.terror',
        sourceRecordId: r.item,
        title: label,
        tStart: at.t,
        tStartPrec: at.prec,
        tEnd: end && end.t >= at.t ? end.t : null,
        tEndPrec: end && end.t >= at.t ? end.prec : null,
        lon: place.lon,
        lat: place.lat,
        geoPrec: own ? GeoPrec.exact : GeoPrec.area,
        magnitude: r.deaths !== undefined && Number.isFinite(deaths) ? deaths : null,
        // nwound as GTD names it, so the attack popup shows it.
        attrs: {
          description: r.desc ?? null,
          nwound: r.injured !== undefined && Number.isFinite(injured) ? injured : null,
          ids: { wikidata: r.item },
          url: url(r),
          wiki: enwikiTitle(r.article) ?? otherArticle(sitelinks[r.item]),
        },
      });
    }
    return batch.finish();
  });
}
