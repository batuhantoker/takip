import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { clauseCut } from '@takip/core/headline';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset, type Reporter } from '../context';
import { EventBatch, resolveCanonical } from '../events';
import { openGeoIndex } from '../geo/geo-index';
import { wikiRef } from '../wiki';
import { EVENT_DATES_FILE, readEventDates } from '../years/event-dates';
import { CLASSES_FILE, readYears, type YearsBullet, type YearsFile, type YearsPage, yearsFile } from '../years/file';
import { KnownEvents } from '../years/known';
import { type Method, placeAccepted } from '../years/place';
import { type BulletDate, sentenceEnd } from '../years/parse';
import { bulletTime, datesMeet, indexLookups, isLong, Linker, sameTime, summarises } from '../years/prepare';

/*
 * Dated events from Wikipedia's year pages, one source per language. A bullet that links an event TAKIP already has
 * becomes a same_as twin of it (the existing event stays canonical: these sources rank last); one that links the same
 * event as a bullet in another language or on another page of this one becomes a twin of the first. The rest are
 * placed by the articles they link (years/place.ts) or left out.
 */

export const YEARS_LANGS = ['en', 'tr', 'de', 'fr', 'ru', 'es', 'ar', 'fa', 'zh', 'ja'] as const;
export const yearsSource = (lang: string) => `wikipedia-years-${lang}`;

/** Share of benchmark bullets each method put within its precision's reach (years/bench.ts, English), the event's confidence. */
const CONFIDENCE: Partial<Record<Method, number>> = {
  'event-article': 0.99, 'event-title': 0.89, 'place-in': 0.87, 'place-links-middle': 0.96, 'description-name': 0.9, 'place-link': 0.87, 'country-link': 0.86,
};

export const GENERAL_KIND = 'event.general';

const MAX_TITLE = 160;
// A Han or kana character says about what two Latin ones do, as the page titles' limits have it (60 and 32).
const MAX_TITLE_CJK = 80;
const CJK = new Set(['zh', 'ja']);

/**
 * The bullet's first sentence; a longer one cut at its last clause that fits, else at a word near the limit. Chinese and
 * Japanese take a clause within MAX_TITLE_CJK where one falls there, and are otherwise held to MAX_TITLE.
 */
export function titleOf(text: string, lang = 'en'): string {
  const s = text.slice(0, sentenceEnd(text)).trim();
  const cjk = CJK.has(lang);
  const short = cjk && s.length > MAX_TITLE_CJK ? clauseCut(s, MAX_TITLE_CJK) : null;
  if (short) return short;
  if (s.length <= MAX_TITLE) return s;
  return clauseCut(s, MAX_TITLE) ?? `${cjk ? s.slice(0, MAX_TITLE) : s.slice(0, MAX_TITLE).replace(/\s+\S*$/, '')}…`;
}

const pageUrl = (lang: string, title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')}`;

/** Stable across refetches as long as the bullet's page, date and words stay; edits elsewhere on the page don't move it. */
const recordId = (page: YearsPage, b: YearsBullet) =>
  `${page.title}#${createHash('sha1').update(`${b.d.y}-${b.d.m ?? ''}-${b.d.d ?? ''}\x1f${b.t}`).digest('hex').slice(0, 12)}`;

type Twin = { record: string; to: { event: number } | { record: string } };

export function importWikipediaYears(lang: string) {
  return async (ctx: Ctx) => {
    const source = yearsSource(lang);
    const path = yearsFile(lang);
    if (!existsSync(path)) return ctx.log(`${source}: ${path} is missing (npx tsx tools/import/fetch-years.ts ${lang}); skipped`);
    const geo = openGeoIndex();
    if (!geo) return ctx.log(`${source}: the geo index isn't built (tools/import/geo/build-index.ts); skipped`);
    try {
      const data = readYears(lang);
      await importDataset(ctx, { source, version: data.fetched, asOf: data.fetched, files: [path, ...[CLASSES_FILE, EVENT_DATES_FILE].filter(f => existsSync(f))], importerVersion: '4' }, async ds => {
        const lookups = indexLookups(geo.db);
        const classRoots = existsSync(CLASSES_FILE) ? (JSON.parse(readFileSync(CLASSES_FILE, 'utf8')) as Record<string, string[]>) : {};
        // Year pages of this language and those after it are left out: a rerun of English must not link to Turkish.
        const later = YEARS_LANGS.slice(YEARS_LANGS.indexOf(lang as (typeof YEARS_LANGS)[number]));
        const skip = later.map(l => ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = ?`).pluck().get(yearsSource(l)) as number | undefined).filter((x): x is number => x !== undefined);
        const linker = new Linker(geo, data, new KnownEvents(ctx.history, [ds.sourceId, ...skip]), classRoots, lookups.classOf, lookups.gnKindOf, readEventDates());
        const batch = new EventBatch(ctx, ds);
        const twins = addBullets(data, linker, geo, batch, ds.report);
        const publish = batch.finish();
        ds.report.extra.links = relateTwins(ctx, ds.sourceId, twins, ds.report);
        ds.report.extra.fetch = data.stats;
        return publish;
      });
    } finally {
      geo.close();
    }
  };
}

function addBullets(data: YearsFile, linker: Linker, geo: NonNullable<ReturnType<typeof openGeoIndex>>, batch: EventBatch, rep: Reporter): Twin[] {
  const lang = data.lang;
  const twins: Twin[] = [];
  /** This run's events by the event article they link, to make a later mention a twin of the first. */
  const mains = new Map<number, { record: string; d: BulletDate; at: { kind: string; lon: number; lat: number; geoPrec: GeoPrec } }[]>();
  const counts: Record<string, number> = {};
  const areaOf = geo.db.prepare(`SELECT area FROM country_info WHERE iso2 = ?`).pluck();
  const count = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  for (const b of data.bullets) {
    rep.rows++;
    const page = data.pages[b.p];
    const record = recordId(page, b);
    if (batch.has(record)) {
      rep.reject('same bullet twice on a page', record);
      continue;
    }
    const p = linker.prepare(b);
    if (b.b && !p.main) {
      rep.reject('only a name, not an event (a ruler in a list)', `${page.title}: ${b.t}`);
      continue;
    }
    const t = bulletTime(b.d);
    // History records what happened; a scheduled event comes in with the fetch after its date.
    if (t.tStart > Date.now()) {
      rep.reject('scheduled, not yet happened', `${page.title}: ${b.t}`);
      continue;
    }
    const main = p.main;
    const base = {
      sourceRecordId: record,
      tStart: t.tStart,
      tStartPrec: t.tStartPrec,
      tEnd: t.tEnd,
      tEndPrec: t.tEndPrec,
      title: titleOf(b.t, lang),
    };
    // A summary line's first link is one event it names, not its subject: given its article, it would take that event's page.
    const wiki = main ? main.title : summarises(b.d) ? undefined : (p.links.find(l => l.role !== 'country') ?? p.links[0])?.title;
    const attrs = {
      ...(b.t !== base.title ? { description: b.t } : {}),
      ...(wiki ? { wiki: wikiRef(lang, wiki) } : {}),
      url: pageUrl(lang, page.title),
      source: { page: page.title, ...(b.s ? { section: b.s } : {}), ...(b.d.approx ? { approximate: true } : {}) },
      ...(main?.qid != null ? { ids: { wikidata: `Q${main.qid}` } } : {}),
    };
    // An event TAKIP already has, at a matching date: this bullet is another source for it.
    const same = p.known.filter(k => !isLong(k) && sameTime(b.d, k)).sort((a, z) => a.canonical - z.canonical);
    if (main && p.known.length && !same.length) count('event link dated otherwise');
    if (same.length) {
      const k = same[0];
      batch.add({ ...base, kind: k.kind, lon: k.lon, lat: k.lat, geoPrec: k.geoPrec as GeoPrec, attrs: { ...attrs, geo: { method: 'same-as' } } });
      twins.push({ record, to: { event: k.canonical } });
      count('linked to an existing event');
      continue;
    }
    const prior = main?.qid != null ? mains.get(main.qid)?.find(x => datesMeet(x.d, b.d)) : undefined;
    if (prior) {
      batch.add({ ...base, ...prior.at, attrs: { ...attrs, geo: { method: 'same-as' } } });
      twins.push({ record, to: { record: prior.record } });
      count('same event as an earlier bullet');
      continue;
    }
    const placed = placeAccepted(geo, { lang, text: b.t, year: b.d.y, links: p.links, ctx: p.ctx, countries: page.countries ?? null }, iso2 => (areaOf.get(iso2) as number | undefined) ?? null);
    if (!placed) {
      rep.reject(p.links.length ? 'no place among its links or text' : 'no links and no place in its text', `${page.title}: ${base.title}`);
      continue;
    }
    const at = { kind: p.kind ?? GENERAL_KIND, lon: placed.lon, lat: placed.lat, geoPrec: placed.geoPrec };
    batch.add({
      ...base,
      ...at,
      confidence: CONFIDENCE[placed.method] ?? 0.9,
      attrs: { ...attrs, placed_at: placed.placedAt, geo: { method: placed.method, ...(placed.detail ? { detail: placed.detail } : {}) } },
    });
    if (main?.qid != null) mains.set(main.qid, [...(mains.get(main.qid) ?? []), { record, d: b.d, at }]);
    count(`placed: ${placed.method}`);
  }
  rep.extra.bullets = counts;
  return twins;
}

/** same_as to the events the bullets repeat; existing sources stay canonical (resolveCanonical ranks these last). */
function relateTwins(ctx: Ctx, sourceId: number, twins: Twin[], rep: Reporter) {
  ctx.events.clearRelations(sourceId);
  let n = 0;
  ctx.history.transaction(() => {
    for (const tw of twins) {
      const from = ctx.events.eventId(sourceId, tw.record);
      const to = 'event' in tw.to ? tw.to.event : ctx.events.eventId(sourceId, tw.to.record);
      if (from === undefined || to === undefined || from === to) continue;
      ctx.events.relate(from, 'same_as', to, 1, sourceId);
      n++;
    }
  })();
  const canonical = resolveCanonical(ctx);
  const families = ctx.history.prepare(`SELECT DISTINCT k.family FROM ev_event e JOIN ev_kind k USING (kind_id) WHERE e.source_id = ?`).pluck().all(sourceId) as string[];
  ctx.events.rebuildTimeline(families);
  rep.sentinel(`same_as: ${n}`);
  return { same_as: n, canonical_updated: canonical };
}
