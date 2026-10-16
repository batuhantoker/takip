import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset, type Reporter, sourceId } from '../context';
import { EventBatch, resolveCanonical } from '../events';
import { REBELLION_CLASSES, WAR_CLASSES } from '../fetch';
import { enwikiTitle, otherArticle } from '../wiki';
import { ATTACKS, BATTLES, DIR, duringWar, POLITICS, WAR_BATTLES, classes, read, readSitelinks, sitelinkFiles, start, url, wdPoint, wdTime, type Row } from './wikidata';

/* Wars and rebellions, revolutions and assassinations, massacres and genocides from Wikidata (CC0); fetch.ts `conflicts`. */

const WARS = join(DIR, 'wars.json');
const REVOLUTIONS = join(DIR, 'revolutions.json');
const MASSACRES = join(DIR, 'massacres.json');
const AS_OF = '2026-10-16';

const CIVIL_WAR = 'Q8465';
/** War of independence; war of national liberation. */
const INDEPENDENCE = ['Q21994376', 'Q1006311'];
const WORLD_WAR = 'Q103495';
const ASSASSINATION = 'Q3882219';
/** Items Wikidata files under revolution that were changes in how people lived, not political events. */
export const NOT_POLITICAL = new Set(['Q180548']); // Neolithic Revolution
const GENOCIDE = 'Q41397';
const WAR_SET = new Set(WAR_CLASSES);
const REBELLION_SET = new Set(REBELLION_CLASSES);

/** An item that is both a war and a rebellion is a war. */
export function warKind(cls: Set<string>): string {
  if (cls.has(WORLD_WAR)) return 'war.world';
  if (cls.has(CIVIL_WAR)) return 'war.civil';
  if (INDEPENDENCE.some(c => cls.has(c))) return 'war.independence';
  if ([...cls].some(c => REBELLION_SET.has(c)) && ![...cls].some(c => WAR_SET.has(c))) return 'conflict.rebellion';
  return 'war';
}

type Place = { lon: number; lat: number; geoPrec: GeoPrec; placedAt?: string };

/**
 * Its own point, else its location's, else the middle of its battles, else its country's. The country comes last:
 * a war between several is sampled to one of them, so it says less than where the battles were.
 */
export function wdPlace(r: Row, battles?: Place): Place | null {
  const own = wdPoint(r.coord);
  if (own) return { ...own, geoPrec: GeoPrec.exact };
  const loc = wdPoint(r.locCoord);
  if (loc) return { ...loc, geoPrec: GeoPrec.area };
  if (battles) return battles;
  const country = wdPoint(r.countryCoord);
  return country ? { ...country, geoPrec: GeoPrec.country } : null;
}


const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** For a war Wikidata places nowhere: the middle of the battles it lists under it (median, so one far battle doesn't drag it). */
export function battleMiddles(battles: Row[]): Map<string, Place> {
  const points = new Map<string, { lon: number; lat: number }[]>();
  for (const b of battles) {
    const p = wdPoint(b.coord) ?? wdPoint(b.locCoord);
    if (!p) continue;
    for (const war of b.wars?.split('|') ?? []) points.set(war, [...(points.get(war) ?? []), p]);
  }
  return new Map([...points].map(([war, ps]) => [war, { lon: median(ps.map(p => p.lon)), lat: median(ps.map(p => p.lat)), geoPrec: GeoPrec.area, placedAt: 'middle of its battles' }]));
}

/** "60000000/20000000/100000000" (amount/lower/upper; bounds may be blank) or a bare number. */
export function deathToll(v: string | undefined): { deaths: number; range?: [number, number] } | null {
  if (!v) return null;
  const [amount, lo, hi] = v.split('/').map(x => (x === '' || x === undefined ? NaN : Number(x)));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Number.isFinite(lo) && Number.isFinite(hi) && lo !== hi ? { deaths: amount, range: [lo, hi] } : { deaths: amount };
}

const itemsOf = (...files: string[]) => new Set(files.filter(f => existsSync(f)).flatMap(f => read<Row[]>(f).map(r => r.item)));

/** Rows to events for one source; `taken` holds items another source already imports. */
function addRows(batch: EventBatch, rep: Reporter, rows: Row[], taken: Set<string>, kindOf: (cls: Set<string>) => string, fallback = new Map<string, Place>()) {
  const sitelinks = readSitelinks();
  for (const r of rows) {
    rep.rows++;
    if (taken.has(r.item)) {
      rep.reject('held by another Wikidata source', r.item);
      continue;
    }
    const label = r.label ?? r.otherLabel;
    const at = start(r);
    if (!label || !at) {
      rep.reject(label ? 'no date' : 'no label', r.item);
      continue;
    }
    const place = wdPlace(r, fallback.get(r.item));
    if (!place) {
      rep.reject('no place', r.item);
      continue;
    }
    const end = wdTime(r.t1);
    const toll = deathToll(r.deaths);
    batch.add({
      kind: kindOf(classes(r)),
      sourceRecordId: r.item,
      title: label,
      tStart: at.t,
      tStartPrec: at.prec,
      tEnd: end && end.t >= at.t ? end.t : null,
      tEndPrec: end && end.t >= at.t ? end.prec : null,
      lon: place.lon,
      lat: place.lat,
      geoPrec: place.geoPrec,
      magnitude: toll?.deaths ?? null,
      attrs: {
        description: r.desc ?? null,
        ...(place.placedAt && { placed_at: place.placedAt }),
        ...(toll?.range && { magnitude_range: toll.range }),
        ids: { wikidata: r.item },
        url: url(r),
        wiki: enwikiTitle(r.article) ?? otherArticle(sitelinks[r.item]),
      },
    });
  }
}

/** Wars and rebellions. A war WAC or COW already has becomes their duplicate; battles Wikidata puts under a war link to it. */
export async function importWikidataWars(ctx: Ctx) {
  await importDataset(ctx, { source: 'wikidata-wars', version: AS_OF, asOf: AS_OF, files: [WARS, ...sitelinkFiles()], importerVersion: '2' }, async ds => {
    const batch = new EventBatch(ctx, ds);
    const rows = read<Row[]>(WARS);
    const middles = existsSync(BATTLES) ? battleMiddles(read<Row[]>(BATTLES)) : undefined;
    addRows(batch, ds.report, rows, itemsOf(BATTLES, POLITICS, ATTACKS), warKind, middles);
    const publish = batch.finish();

    ctx.events.clearRelations(ds.sourceId);
    const same = linkKnownWars(ctx, ds.sourceId, batch);
    const canonical = resolveCanonical(ctx);
    const battles = linkBattles(ctx, ds.sourceId, batch);
    ctx.events.rebuildTimeline(['conflict']);
    ds.report.extra.links = { same_as: same, ...battles, canonical_updated: canonical };
    return publish;
  });
}

/** same_as from a Wikidata war to the WAC or COW war whose article is the same item (fetch.ts `war-battles`). */
function linkKnownWars(ctx: Ctx, wars: number, batch: EventBatch) {
  if (!existsSync(WAR_BATTLES)) return 'skipped: run `fetch.ts war-battles`';
  const known = read<{ wars: { key: string; qid: string }[] }>(WAR_BATTLES).wars;
  const sources: Record<string, number[]> = { wac1914: [sourceId(ctx, 'wac1914')], cow: [sourceId(ctx, 'cow-interstate'), sourceId(ctx, 'cow-extra')] };
  let n = 0;
  ctx.history.transaction(() => {
    for (const { key, qid } of known) {
      const [table, record] = key.split(':');
      const to = sources[table]?.map(s => ctx.events.eventId(s, record)).find(e => e !== undefined);
      const from = batch.has(qid) ? ctx.events.eventId(wars, qid) : undefined;
      if (to === undefined || from === undefined) continue;
      ctx.events.relate(from, 'same_as', to, 1, wars);
      n++;
    }
  })();
  return n;
}

/** part_of from each Wikidata battle to the war it names, between canonical events, unless already linked. */
function linkBattles(ctx: Ctx, wars: number, batch: EventBatch) {
  if (!existsSync(BATTLES)) return { part_of: 0 };
  const battles = sourceId(ctx, 'wikidata-battles');
  const canonical = ctx.history.prepare(`SELECT coalesce(canonical_id, event_id) FROM ev_event WHERE event_id = ? AND retracted_at IS NULL`).pluck();
  const linked = ctx.history.prepare(`SELECT 1 FROM ev_event_relation WHERE from_id = ? AND rel = 'part_of' AND to_id = ?`).pluck();
  const during = duringWar(ctx);
  let n = 0;
  ctx.history.transaction(() => {
    for (const r of read<Row[]>(BATTLES)) {
      for (const war of r.wars?.split('|') ?? []) {
        if (!batch.has(war)) continue;
        const b = ctx.events.eventId(battles, r.item);
        const w = ctx.events.eventId(wars, war);
        const from = b === undefined ? undefined : (canonical.get(b) as number | undefined);
        const to = w === undefined ? undefined : (canonical.get(w) as number | undefined);
        if (from === undefined || to === undefined || from === to || linked.get(from, to) || !during(from, to)) continue;
        ctx.events.relate(from, 'part_of', to, 1, wars);
        n++;
      }
    }
  })();
  return { part_of: n };
}

/** Revolutions and assassinations, unless a war, coup or treaty item covers them. */
export async function importWikidataRevolutions(ctx: Ctx) {
  await importDataset(ctx, { source: 'wikidata-revolutions', version: AS_OF, asOf: AS_OF, files: [REVOLUTIONS, ...sitelinkFiles()], importerVersion: '2' }, async ds => {
    const batch = new EventBatch(ctx, ds);
    addRows(batch, ds.report, read<Row[]>(REVOLUTIONS).filter(r => !NOT_POLITICAL.has(r.item) || (ds.report.reject('not a political event (NOT_POLITICAL)', r.item), false)), itemsOf(BATTLES, POLITICS, ATTACKS, WARS),
      cls => (cls.has(ASSASSINATION) ? 'politics.assassination' : 'politics.revolution'));
    return batch.finish();
  });
}

/** Massacres and genocides that are not terrorist attacks (those are GTD's or wikidata-attacks'), battles or wars. */
export async function importWikidataMassacres(ctx: Ctx) {
  await importDataset(ctx, { source: 'wikidata-massacres', version: AS_OF, asOf: AS_OF, files: [MASSACRES, ...sitelinkFiles()], importerVersion: '1' }, async ds => {
    const batch = new EventBatch(ctx, ds);
    addRows(batch, ds.report, read<Row[]>(MASSACRES), itemsOf(BATTLES, ATTACKS, WARS, REVOLUTIONS),
      cls => (cls.has(GENOCIDE) ? 'conflict.genocide' : 'conflict.massacre'));
    return batch.finish();
  });
}
