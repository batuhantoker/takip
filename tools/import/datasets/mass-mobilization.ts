import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { km } from '../articles';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { csvRecords, num } from '../csv';
import { ymd } from '../dates';
import { EventBatch, resolveCanonical } from '../events';
import { MM_FILE } from '../fetch-geocoded';
import { openGeoIndex } from '../geo/geo-index';
import { normName } from '../names';
import { Resolver } from '../resolver';
import { Capitals } from './capitals';
import { namesCountry } from './cline';
import { countryCodes, parseLocation, placeProtest } from './mass-mobilization-places';

const FILE = join(RAW_MORE, 'mass-mobilization', MM_FILE);
const VERSION = '5.1';
const AS_OF = '2020-07-31';
const DAY_MS = 86_400_000;

/**
 * Polity keys for MM's names where its codes aren't COW's (MM's 347 is Yugoslavia, COW's Kosovo) or the seed has no
 * such name; the first whose capital covers the date wins.
 */
const POLITY_KEYS: Record<string, string[]> = {
  USSR: ['hist:SUN'],
  Yugoslavia: ['hist:YUG', 'hist:SCG'],
  'Serbia and Montenegro': ['hist:SCG'],
  Serbia: ['SRB'],
  Montenegro: ['MNE'],
  Kosovo: ['KOS'],
  Czechoslovakia: ['hist:CSK'],
  'Germany East': ['hist:DDR'],
  'Germany West': ['hist:BRD', 'DEU'],
  'United Arab Emirate': ['ARE'],
};

const str = (v: string | undefined) => v?.trim() || null;
const titleCase = (s: string) => (s === s.toLowerCase() ? s.replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : s);

export type MmProtest = { key: string; t: number; lon: number; lat: number; country: string; atCapital: boolean };
export type WdUnrest = { id: number; title: string; t: number; prec: Prec; lon: number; lat: number };

/** The label names the country or its people: namesCountry, plus stems a letter or two shorter ("Lebanese", "Kenyan"). */
export function labelNamesCountry(label: string, country: string) {
  if (namesCountry(label, country)) return true;
  const fold = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const words = fold(label).split(/[^\p{L}]+/u);
  const name = fold(country);
  return [1, 2].some(n => name.length - n >= 5 && !name.includes(' ') && words.some(w => w.startsWith(name.slice(0, -n))));
}

/** Same event: Wikidata's starts within a day of MM's and lies within this of it. */
const NEAR_KM = 50;

/**
 * Pairs each day-dated Wikidata riot, protest or strike with the MM protest it repeats: start within a day, within
 * 50 km, the closest in time then distance. An MM protest placed at the capital only because it was nationwide pairs
 * only with an item whose label names the country, or every local event in the capital would match it. One MM
 * protest takes one item: two Wikidata items joined through it would hide one of them.
 */
export function matchProtests(mm: MmProtest[], wd: WdUnrest[]) {
  const byDay = new Map<number, MmProtest[]>();
  for (const p of mm) {
    const d = Math.floor(p.t / DAY_MS);
    byDay.set(d, [...(byDay.get(d) ?? []), p]);
  }
  const best = new Map<string, { wdId: number; gap: number; d: number }>();
  let ambiguous = 0;
  let shared = 0;
  for (const w of wd) {
    if (w.prec < Prec.day) continue;
    const d = Math.floor(w.t / DAY_MS);
    const hits = [d - 1, d, d + 1]
      .flatMap(x => byDay.get(x) ?? [])
      .filter(p => Math.abs(p.t - w.t) <= DAY_MS && km(p, w) <= NEAR_KM && (!p.atCapital || labelNamesCountry(w.title, p.country)))
      .map(p => ({ p, gap: Math.abs(p.t - w.t), d: km(p, w) }))
      .sort((a, b) => a.gap - b.gap || a.d - b.d);
    if (!hits.length) continue;
    if (hits.length > 1 && hits[1].gap === hits[0].gap && Math.abs(hits[1].d - hits[0].d) < 1) {
      ambiguous++;
      continue;
    }
    const h = hits[0];
    const prev = best.get(h.p.key);
    if (prev) shared++;
    if (!prev || h.gap < prev.gap || (h.gap === prev.gap && h.d < prev.d)) best.set(h.p.key, { wdId: w.id, gap: h.gap, d: h.d });
  }
  const pairs = [...best].map(([key, b]) => [key, b.wdId] as [mmKey: string, wdId: number]);
  return { pairs, ambiguous, shared };
}

const PREC_NAME: Record<number, string> = { 1: 'exact', 2: 'city', 3: 'area', 4: 'approximate', 5: 'country' };
const tally = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

/**
 * Mass Mobilization Project v5.1 (Clark & Regan, CC0): protests against governments, 1990–2020, placed from the
 * free-text location with the geolocation index (docs/architecture/geolocation.md). Rows with protest = 0 are
 * country-years without one.
 */
export async function importMassMobilization(ctx: Ctx) {
  await importDataset(ctx, { source: 'mass-mobilization', version: VERSION, asOf: AS_OF, files: [FILE], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const geo = openGeoIndex();
    if (!geo) throw new Error('mass-mobilization needs data/db/geo-index.db (tools/import/geo/build-index.ts)');
    const r = new Resolver(ctx);
    const capitals = await Capitals.read(ctx);
    const entityName = ctx.catalog.prepare(`SELECT name FROM core_entity WHERE entity_id = ?`).pluck();
    const batch = new EventBatch(ctx, ds);
    const placed: MmProtest[] = [];
    const by = { method: {} as Record<string, number>, prec: {} as Record<string, number> };

    const polity = (country: string, ccode: string, t: number) => {
      for (const key of POLITY_KEYS[country] ?? []) {
        const id = r.key(key);
        if (capitals.at(id, t)) return id;
      }
      const byName = r.byName(country, t, { politiesOnly: true });
      const byCode = r.resolve('cow', ccode, t);
      if (byName !== undefined && byCode !== undefined && byName !== byCode) rep.sentinel(`${country} (${ccode}): name and COW code disagree, name taken`);
      const id = [byName, byCode].find(x => capitals.at(x, t)) ?? byName ?? byCode;
      if (id === undefined) rep.miss(`mm:${ccode} ${country}`);
      return id;
    };
    const codes = new Map<string, string[]>();

    for await (const row of csvRecords(FILE)) {
      if (row.__header__) continue;
      rep.rows++;
      if (row.protest !== '1') {
        rep.reject('country-year with no protest (protest = 0)', row.id);
        continue;
      }
      const start = ymd(num(row.startyear), num(row.startmonth), num(row.startday));
      if (!start) {
        rep.reject('no start date', row.id);
        continue;
      }
      const end = ymd(num(row.endyear), num(row.endmonth), num(row.endday));
      const country = row.country.trim();
      if (!codes.has(country)) codes.set(country, countryCodes(geo, country));
      const entity = polity(country, row.ccode.trim(), start.t);
      const capital = capitals.at(entity, start.t);
      const location = row.location ?? '';
      const own = codes.get(country)!;
      const where = parseLocation(location, s => geo.country(normName(s))?.iso2 === own[0]);
      const at = placeProtest(geo, where, own, capital, location);
      if ('reject' in at) {
        rep.reject(at.reject, `${row.id} ${country}: ${location.trim()}`);
        continue;
      }
      if (at.fixed) rep.sentinel(`spelling: ${at.fixed} → ${at.name}`);
      const name = (entity !== undefined ? (entityName.get(entity) as string | undefined) : undefined) ?? country;
      const title = at.method === 'capital'
        ? where.nationwide ? `Nationwide protest in ${name}` : `Protest in ${name}`
        : `Protest in ${titleCase(at.fixed ? at.name! : (at.name ?? location.trim()))}, ${name}`;
      const list = (cols: string[]) => cols.map(c => str(row[c])).filter((x): x is string => !!x && x !== '.');
      batch.add({
        kind: 'politics.protest',
        sourceRecordId: row.id,
        title,
        tStart: start.t,
        tStartPrec: start.prec,
        tEnd: end && end.t > start.t ? end.t : null,
        tEndPrec: end && end.t > start.t ? end.prec : null,
        lon: at.lon,
        lat: at.lat,
        geoPrec: at.geoPrec,
        ...(at.confidence !== undefined && { confidence: at.confidence }),
        attrs: {
          participants: str(row.participants) === '.' ? null : str(row.participants),
          participants_category: str(row.participants_category),
          protesters: str(row.protesteridentity),
          demands: list(['protesterdemand1', 'protesterdemand2', 'protesterdemand3', 'protesterdemand4']),
          state_response: list(['stateresponse1', 'stateresponse2', 'stateresponse3', 'stateresponse4', 'stateresponse5', 'stateresponse6', 'stateresponse7']),
          protester_violence: row.protesterviolence === '1' ? true : row.protesterviolence === '0' ? false : null,
          location: str(location),
          ...(where.nationwide && { scope: 'nationwide' }),
          country_as_coded: country,
          notes: str(row.notes),
          sources: str(row.sources),
          placed_at: at.placedAt,
          geo_method: at.method,
          ...(at.confidence !== undefined && { geo_confidence: at.confidence }),
          ids: { mass_mobilization: row.id },
        },
        entities: entity !== undefined ? [{ entityId: entity, role: 'location' }] : [],
      });
      tally(by.method, at.method);
      tally(by.prec, PREC_NAME[at.geoPrec]);
      placed.push({ key: row.id, t: start.t, lon: at.lon, lat: at.lat, country: name, atCapital: at.method === 'capital' });
    }
    rep.extra.placed = by;
    const publish = batch.finish();
    rep.extra.links = linkWikidata(ctx, ds.sourceId, placed, rep);
    return publish;
  });
}

/** same_as to the Wikidata riot, protest or strike each MM protest repeats; Wikidata's, loaded first with its article, stays canonical. */
function linkWikidata(ctx: Ctx, source: number, placed: MmProtest[], rep: Reporter) {
  const wdSource = ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = 'wikidata-unrest'`).pluck().get() as number | undefined;
  ctx.events.clearRelations(source);
  if (wdSource === undefined) return 'skipped: wikidata-unrest is not loaded';
  const wd = ctx.history.prepare(`
    SELECT e.event_id AS id, e.title, e.t_start AS t, e.t_start_prec AS prec, e.lon, e.lat
    FROM ev_event e JOIN ev_kind k USING (kind_id)
    WHERE e.source_id = ? AND k.code IN ('politics.protest', 'politics.riot', 'politics.strike') AND e.retracted_at IS NULL AND e.lon IS NOT NULL AND e.t_start >= ?
  `).all(wdSource, Date.UTC(1989, 11, 30)) as WdUnrest[];
  const { pairs, ambiguous, shared } = matchProtests(placed, wd);
  ctx.history.transaction(() => {
    for (const [key, wdId] of pairs) ctx.events.relate(ctx.events.eventId(source, key)!, 'same_as', wdId, 1, source);
  })();
  for (const [key, wdId] of pairs.slice(0, 8)) rep.sentinel(`same_as sample: ${key} → ${wd.find(w => w.id === wdId)?.title}`);
  const canonical = resolveCanonical(ctx);
  ctx.events.rebuildTimeline(['politics']);
  return { wikidata_unrest: wd.length, same_as: pairs.length, ambiguous, left_for_a_closer_item: shared, canonical_updated: canonical };
}
