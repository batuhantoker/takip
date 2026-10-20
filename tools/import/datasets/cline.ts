import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { km, sameTime } from '../articles';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { num, readCsv } from '../csv';
import { utc } from '../dates';
import { EventBatch, resolveCanonical } from '../events';
import { CLINE_FILE } from '../fetch-politics';
import { Resolver } from '../resolver';
import { type Capital, Capitals, CAPITALS, capitalPlacedAt } from './capitals';

const FILE = join(RAW_MORE, 'cline', CLINE_FILE);
const VERSION = '2.2.2';
const AS_OF = '2026-02-17';

/** Cline's event_type: realized coups, unrealized attempts, and conspiracies stopped before any attempt. */
export const OUTCOMES: Record<string, { kind: string; outcome: string; title: (country: string) => string }> = {
  coup: { kind: 'politics.coup', outcome: 'successful', title: c => `Coup in ${c}` },
  'attempted coup': { kind: 'politics.coup.attempt', outcome: 'attempted, failed', title: c => `Failed coup in ${c}` },
  conspiracy: { kind: 'politics.coup.conspiracy', outcome: 'plotted, stopped before any attempt', title: c => `Coup plot in ${c}` },
};

/** Who carried it out (codebook §2): a coup can be several at once, a palace coup by the military, say. */
const ACTORS: [col: string, label: string][] = [
  ['military', 'military'], ['dissident', 'dissidents'], ['rebel', 'rebels'], ['palace', 'palace (ruling elite)'], ['foreign', 'foreign-backed'],
  ['auto', 'self-coup by the incumbent'], ['resign', 'forced resignation'], ['popular', 'popular revolt'], ['counter', 'counter-coup'], ['other', 'other'],
];
/** What happened to the deposed or targeted leader. */
const FATES: [col: string, label: string][] = [
  ['noharm', 'unharmed'], ['injured', 'injured'], ['killed', 'killed'], ['harrest', 'house arrest'], ['jailed', 'jailed'],
  ['tried', 'tried'], ['fled', 'fled'], ['exile', 'exiled'],
];

const flags = (r: Record<string, string>, cols: [string, string][]) => cols.filter(([c]) => num(r[c]) === 1).map(([, label]) => label);

export type ClineCoup = { id: string; t: number; country: string; capitals: Capital[]; lon: number; lat: number };
export type WikidataCoup = { id: number; title: string; t: number; prec: Prec; lon: number; lat: number };

/** Wikidata and Cline date a coup up to a few days apart (first move against the day power changed hands). */
const WINDOW_MS = 3 * 86_400_000;
/** Within the window, a Wikidata coup is the same coup if it sits at one of the country's capitals. */
const NEAR_KM = 150;
/** Farther only when its label names the country ("1966 Nigerian coup"), since items may sit at their own coordinates. */
const NAMED_KM = 1500;

/** A label word starting with the country's name, or with it less a final vowel: "Bolivian", "Argentine". */
export function namesCountry(label: string, country: string) {
  const fold = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const name = fold(country);
  const stems = [name, ...(name.length >= 5 ? [name.replace(/[aeiouy]$/, '')] : [])];
  const words = fold(label).split(/[^\p{L}]+/u);
  return stems.some(stem => !stem.includes(' ') ? words.some(w => w.startsWith(stem)) : fold(label).includes(stem));
}

/**
 * Pairs each Wikidata coup dated to the day or month with the one Cline coup it describes, the closest in time when
 * several qualify. Year-dated items are left alone: a year holds several coups in one country.
 */
export function matchCoups(cline: ClineCoup[], wd: WikidataCoup[]) {
  const pairs: [clineId: string, wdId: number][] = [];
  let ambiguous = 0;
  for (const w of wd) {
    if (w.prec < Prec.month) continue;
    const hits = cline
      .filter(c => (w.prec >= Prec.day ? Math.abs(c.t - w.t) <= WINDOW_MS : sameTime(c.t, Prec.day, w.t, w.prec)))
      .map(c => ({ c, d: Math.min(km(c, w), ...c.capitals.map(cap => km(cap, w))), named: namesCountry(w.title, c.country) }))
      .filter(h => h.d <= NEAR_KM || (h.named && h.d <= NAMED_KM));
    const named = hits.some(h => h.named) && hits.length > 1 ? hits.filter(h => h.named) : hits;
    // A month-dated item can't tell two coups that month apart.
    const gap = (c: ClineCoup) => (w.prec >= Prec.day ? Math.abs(c.t - w.t) : 0);
    const closest = Math.min(...named.map(h => gap(h.c)));
    const best = named.filter(h => gap(h.c) === closest);
    if (best.length === 1) pairs.push([best[0].c.id, w.id]);
    else if (best.length > 1) ambiguous++;
  }
  return { pairs, ambiguous };
}

/** Cline Center Coup d'État Project (CC BY 4.0): coups, failed attempts and plots since 1945, at the capital. */
export async function importCline(ctx: Ctx) {
  await importDataset(ctx, { source: 'cline-coups', version: VERSION, asOf: AS_OF, files: [FILE, CAPITALS], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const capitals = await Capitals.read(ctx);
    const name = ctx.catalog.prepare(`SELECT name FROM core_entity WHERE entity_id = ?`).pluck();
    const batch = new EventBatch(ctx, ds);
    const placed: ClineCoup[] = [];
    for (const row of await readCsv(FILE)) {
      rep.rows++;
      const type = OUTCOMES[row.event_type];
      const [y, m, d] = [num(row.year), num(row.month), num(row.day)];
      if (!type || y === null || !m || !d) {
        rep.reject(type ? 'no full date' : `event_type ${row.event_type}`, row.coup_id);
        continue;
      }
      const t = utc(y, m, d);
      // COW 260 stays West Germany after 1990 in the crosswalk, and Serbia (340) and Russia (393) aren't in it; the name finds those.
      const byCode = r.resolve('cow', row.cowcode, t);
      const entity = capitals.at(byCode, t) ? byCode : r.byName(row.country, t, { politiesOnly: true });
      const capital = capitals.at(entity, t);
      if (!capital || entity === undefined) {
        rep.reject('no capital for the country', `${row.coup_id} cow:${row.cowcode} ${row.country}`);
        continue;
      }
      if (entity !== byCode) rep.sentinel(`cow:${row.cowcode} → by name ${row.country}`);
      const country = (name.get(entity) as string | undefined) ?? row.country;
      batch.add({
        kind: type.kind,
        sourceRecordId: row.coup_id,
        title: type.title(country),
        tStart: t,
        tStartPrec: Prec.day,
        lon: capital.lon,
        lat: capital.lat,
        geoPrec: GeoPrec.area,
        attrs: {
          outcome: type.outcome,
          carried_out_by: flags(row, ACTORS),
          leader_fate: flags(row, FATES),
          country_as_coded: row.country,
          placed_at: capitalPlacedAt(capital),
          ids: { cline: row.coup_id, cow: row.cowcode },
        },
      });
      placed.push({ id: row.coup_id, t, country, capitals: capitals.all(entity), lon: capital.lon, lat: capital.lat });
    }
    const publish = batch.finish();
    rep.extra.links = linkWikidata(ctx, ds.sourceId, placed, rep);
    return publish;
  });
}

/** same_as to the Wikidata coup each Cline coup repeats; Wikidata's, loaded first with its article, stays canonical. */
function linkWikidata(ctx: Ctx, clineSource: number, placed: ClineCoup[], rep: Reporter) {
  const wdSource = ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = 'wikidata-politics'`).pluck().get() as number | undefined;
  ctx.events.clearRelations(clineSource);
  if (wdSource === undefined) return 'skipped: wikidata-politics is not loaded';
  const wd = ctx.history.prepare(`
    SELECT e.event_id AS id, e.title, e.t_start AS t, e.t_start_prec AS prec, e.lon, e.lat
    FROM ev_event e JOIN ev_kind k USING (kind_id)
    WHERE e.source_id = ? AND k.code = 'politics.coup' AND e.retracted_at IS NULL AND e.lon IS NOT NULL AND e.t_start >= ?
  `).all(wdSource, utc(1944)) as WikidataCoup[];
  const { pairs, ambiguous } = matchCoups(placed, wd);
  ctx.history.transaction(() => {
    for (const [clineId, wdId] of pairs) ctx.events.relate(ctx.events.eventId(clineSource, clineId)!, 'same_as', wdId, 1, clineSource);
  })();
  for (const [clineId, wdId] of pairs.slice(0, 5)) rep.sentinel(`same_as sample: ${clineId} → ${wd.find(w => w.id === wdId)?.title}`);
  const canonical = resolveCanonical(ctx);
  ctx.events.rebuildTimeline(['politics']);
  return { wikidata_coups: wd.length, same_as: pairs.length, ambiguous, canonical_updated: canonical };
}
