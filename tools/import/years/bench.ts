// Measures how well year-page bullets place: takes the bullets whose event link has exact coordinates (TAKIP's own,
// or Wikidata's in the geo index), hides that article, places each from the rest, and reports the error per method
// and language; then how the bullets' dates compare with Wikidata's for the same events.
//
//   nice npx tsx tools/import/years/bench.ts [en tr …] [--out <dir>]
//
// Reads RAW_MORE/wikipedia-years/<lang>.json and event-dates.json, history.db read-only, and geo-index.db.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { GeoPrec } from '@takip/db';
import { utc } from '../dates';
import { km } from '../geo/candidates';
import { SqliteGeoIndex } from '../geo/geo-index';
import { markdown, summarise, type Trial } from '../geo/bench/stats';
import { CLASSES_FILE, readYears, yearsFile } from './file';
import { readEventDates } from './event-dates';
import { KnownEvents } from './known';
import { LANG_CODES } from './langs';
import { byMethod, type Method, METHODS, place, placeAccepted, type PlaceInput } from './place';
import { bulletTime, indexLookups, Linker, sameTime, timing } from './prepare';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const OUT = outAt >= 0 ? args[outAt + 1] : join('.cache', 'wikipedia-years', 'benchmark');
const langs = args.filter((a, i) => !a.startsWith('--') && i !== outAt + 1).filter(l => existsSync(yearsFile(l)));
const PREC_NAME: Record<number, string> = { [GeoPrec.exact]: 'exact', [GeoPrec.city]: 'city', [GeoPrec.area]: 'area', [GeoPrec.approximate]: 'approximate', [GeoPrec.country]: 'country' };
/** The cascade as the importer would run it, without the hidden article's own coordinates. */
const CASCADE: Method[] = METHODS.filter(m => m !== 'event-article');

const index = new SqliteGeoIndex();
const history = new Database(join('data', 'db', 'history.db'), { readonly: true, fileMustExist: true });
const known = new KnownEvents(history);
const classRoots = existsSync(CLASSES_FILE) ? (JSON.parse(readFileSync(CLASSES_FILE, 'utf8')) as Record<string, string[]>) : {};
const lookups = indexLookups(index.db);
const eventDates = readEventDates();
const areaOf = index.db.prepare(`SELECT area FROM country_info WHERE iso2 = ?`).pluck();
/** Country placements by the country's size: a point for Ireland is near anywhere in it, one for Russia isn't. */
const sizeClass = (iso2: string | undefined) => {
  const a = iso2 ? ((areaOf.get(iso2) as number | undefined) ?? null) : null;
  return a === null ? 'unknown size' : a < 150_000 ? '<150k km²' : a < 600_000 ? '150k–600k km²' : '≥600k km²';
};

/** `about`: the bullet is surely about its event: dated as TAKIP dates it, or opening with the event's name. */
type Case = { lang: string; id: string; set: 'takip' | 'index'; about: boolean; truth: { lon: number; lat: number }; x: PlaceInput; text: string };

function main() {
  mkdirSync(OUT, { recursive: true });
  const trials: Trial[] = [];
  const tried = new Map<string, number>();
  const count = (k: string, n = 1) => tried.set(k, (tried.get(k) ?? 0) + n);
  const dates: Record<string, Record<string, number>> = {};
  const agree: Record<string, Record<string, { n: number; inside: number }>> = {};
  const samples: unknown[] = [];
  const misses: unknown[] = [];
  for (const lang of langs.length ? langs : LANG_CODES.filter(l => existsSync(yearsFile(l)))) {
    const file = readYears(lang);
    const linker = new Linker(index, file, known, classRoots, lookups.classOf, lookups.gnKindOf, eventDates);
    const all: Case[] = [];
    const dt = (dates[lang] ??= {});
    const inPage = (agree[lang] ??= {});
    for (let i = 0; i < file.bullets.length; i++) {
      const b = file.bullets[i];
      const p = linker.prepare(b);
      const page = file.pages[b.p];
      // Every bullet of a "<year> in X" page, placed as the importer would: is it put in X?
      if (page.countries?.length) {
        const r = placeAccepted(index, { lang, text: b.t, year: b.d.y, links: p.links, ctx: p.ctx, countries: page.countries }, iso2 => (areaOf.get(iso2) as number | undefined) ?? null);
        if (r?.country) {
          const g = (inPage[r.method] ??= { n: 0, inside: 0 });
          g.n++;
          if (page.countries.includes(r.country)) g.inside++;
        }
      }
      if (!p.main || p.main.qid === null) continue;
      // Before any filtering: the first event it links that Wikidata dates within a year.
      const first = b.l.map(i => linker.link(i)).find(x => x.linked.role === 'event' && x.linked.qid !== null && timing(b.d, eventDates[`Q${x.linked.qid}`]) !== 'long' && eventDates[`Q${x.linked.qid}`]);
      if (first) dateCheck(dt, b.d, eventDates[`Q${first.linked.qid}`]!);
      const exact = p.known.find(k => k.geoPrec === GeoPrec.exact && k.lon !== null && k.lat !== null);
      const item = index.item(p.main.qid);
      const truth = exact ? { lon: exact.lon!, lat: exact.lat! } : item?.kind === 'event' ? { lon: item.lon, lat: item.lat } : null;
      if (!truth) continue;
      if (exact && p.main.point) trials.push({ set: lang, method: 'event-article (flattered)', hit: true, err: km(p.main.point, truth), geoPrec: GeoPrec.exact });
      // Surely about it: dated as TAKIP or Wikidata date the event, or, with no date to tell, opening with its name.
      const t = timing(b.d, eventDates[`Q${p.main.qid}`]);
      const about = exact ? sameTime(b.d, exact) : t === 'agrees' || (t === 'unknown' && b.t.startsWith(p.main.title.replace(/\s*\(.*\)$/, '')));
      all.push({
        lang, id: `${page.title}#${i}`, set: exact ? 'takip' : 'index', about, truth, text: b.t,
        x: { lang, text: b.t, year: b.d.y, links: p.links, ctx: p.ctx, countries: page.countries ?? null, hide: p.main.qid, hideTitle: true },
      });
    }
    count(`${lang}|event-article (flattered)`, trials.filter(t => t.set === lang).length);
    // Scored on the bullets surely about their event; the loose set also counts mentions ("… for the famine in Ethiopia").
    const cases = all.filter(c => c.about);
    console.log(`${lang}: ${file.bullets.length} bullets, ${all.length} with an event link placed exactly (${all.filter(c => c.set === 'takip').length} in TAKIP), ${cases.length} surely about it`);
    for (const m of CASCADE) {
      for (const c of all) {
        const r = byMethod(index, c.x, m);
        trials.push(r ? { set: `${lang} loose`, id: c.id, method: m, hit: true, err: km(r, c.truth), geoPrec: r.geoPrec } : { set: `${lang} loose`, id: c.id, method: m, hit: false });
      }
      count(`${lang} loose|${m}`, all.length);
    }
    for (const m of CASCADE) {
      for (const c of cases) {
        const r = byMethod(index, c.x, m);
        const kind = m === 'country-link' || m === 'country-page' ? sizeClass(r?.kind) : r?.kind;
        trials.push(r ? { set: lang, id: c.id, method: m, hit: true, err: km(r, c.truth), geoPrec: r.geoPrec, kind, detail: r.detail } : { set: lang, id: c.id, method: m, hit: false });
        if (r && km(r, c.truth) > 100 && misses.length < 3000) misses.push({ method: m, id: c.id, err: Math.round(km(r, c.truth)), kind: r.kind, detail: r.detail, text: c.text.slice(0, 200) });
      }
      count(`${lang}|${m}`, cases.length);
    }
    for (const [label, methods] of [['accepted', null], ['cascade', CASCADE], ['cascade without event-title', CASCADE.filter(m => m !== 'event-title')]] as const) {
      for (const c of cases) {
        const r = methods ? place(index, c.x, methods) : placeAccepted(index, c.x, iso2 => (areaOf.get(iso2) as number | undefined) ?? null);
        trials.push(r ? { set: lang, id: c.id, method: `${label}:${r.method}`, hit: true, err: km(r, c.truth), geoPrec: r.geoPrec } : { set: lang, id: c.id, method: label, hit: false });
        if (r && label === 'accepted' && samples.length < 4000) samples.push({ id: c.id, text: c.text.slice(0, 160), method: r.method, err: Math.round(km(r, c.truth)), detail: r.detail, placedAt: r.placedAt });
      }
      count(`${lang}|${label}`, cases.length);
    }
  }
  const triedOf = (key: string) => {
    const [set, method] = key.split('|');
    const m = method.replace(/ (exact|city|area|approximate|country)$/, '').replace(/:.*$/, '').replace(/ \[.*\]$/, '');
    return set === 'all' ? [...tried].filter(([k]) => k.endsWith(`|${m}`) && !k.includes(' loose|')).reduce((s, [, n]) => s + n, 0) : (tried.get(`${set}|${m}`) ?? 0);
  };
  const sections: [string, ReturnType<typeof summarise>][] = [
    ['By method, all languages', summarise(trials.filter(t => !t.set.endsWith('loose')), t => `all|${t.method.replace(/:.*$/, '')}`, triedOf)],
    ['Cascade by the method that placed it', summarise(trials.filter(t => t.method.includes(':')), t => `all|${t.method}`, triedOf)],
    ['By method and precision', summarise(trials.filter(t => !t.method.includes(':') && !t.set.endsWith('loose')), t => `all|${t.method} ${PREC_NAME[t.geoPrec ?? 0] ?? ''}`, triedOf)],
    ['By the kind of place (country methods: by the country\'s area)', summarise(trials.filter(t => !t.set.endsWith('loose') && /^(place-in|place-link|context-place|event-title|description-name|coords-link|country-link|country-page)$/.test(t.method)), t => `all|${t.method} [${t.kind}]`, triedOf)],
    ['By language and method', summarise(trials, t => `${t.set}|${t.method.replace(/:.*$/, '')}`, triedOf)],
  ];
  const reach = reachTable(trials.filter(t => t.hit && !t.method.includes(':') && t.method !== 'event-article (flattered)' && !t.set.endsWith('loose')));
  const reachLoose = reachTable(trials.filter(t => t.hit && t.set.endsWith('loose')));
  const reachAccepted = reachTable(trials.filter(t => t.hit && t.method.startsWith('accepted:')).map(t => ({ ...t, method: `${t.set} ${t.method.replace('accepted:', '')}` })));
  const dateTable = Object.entries(dates).map(([lang, d]) => `| ${lang} | ${['day=', 'day±1', 'day±14', 'month', 'year', 'other year', 'month=', 'month other', 'year=', 'year other'].map(k => d[k] ?? 0).join(' | ')} |`);
  const md = `${sections.map(([title, rows]) => `### ${title}\n\n${markdown(rows, 'set|method')}`).join('\n\n')}\n\n### Within reach of the precision given (exact 10 km, city 25, area 100, approximate 300, country 1000)\n\n${reach}\n\n### The accepted cascade, by the method that placed each bullet\n\n${reachAccepted}\n\n### The same on every bullet whose event link has exact coordinates, mentions included\n\n${reachLoose}\n\n### Dates against Wikidata's for the first event each bullet links (events of under a year)\n\n| lang | day same | ±1 day | ±14 days | same month | same year | other year | month same | month other | year same | year other |\n|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|\n${dateTable.join('\n')}\n`;
  const agreeRows = Object.entries(agree).flatMap(([lang, ms]) => Object.entries(ms).map(([m, g]) => `| ${lang} | ${m} | ${g.n} | ${((100 * g.inside) / g.n).toFixed(0)}% |`));
  const md2 = `${md}\n### Bullets of "<year> in X" pages put inside X (every bullet the cascade places at a known country)\n\n| lang | method | placed | inside X |\n|---|---|--:|--:|\n${agreeRows.join('\n')}\n`;
  writeFileSync(join(OUT, 'benchmark.md'), md2);
  writeFileSync(join(OUT, 'samples.json'), JSON.stringify(samples, null, 1));
  writeFileSync(join(OUT, 'misses.json'), JSON.stringify(misses, null, 1));
  console.log(md2);
}

const REACH: Record<number, number> = { [GeoPrec.exact]: 10, [GeoPrec.city]: 25, [GeoPrec.area]: 100, [GeoPrec.approximate]: 300, [GeoPrec.country]: 1000 };

/** Per method and precision, the share placed within that precision's reach: the measure geolocation.md accepted methods by. */
function reachTable(hits: Trial[]): string {
  const groups = new Map<string, { n: number; ok: number; in300: number; in1000: number }>();
  for (const t of hits) {
    const m = /(?:^| )country-/.test(t.method) ? `${t.method} ${t.kind}` : t.method;
    for (const key of [`${m} | all`, `${m} | ${PREC_NAME[t.geoPrec ?? 0]}`]) {
      const g = groups.get(key) ?? { n: 0, ok: 0, in300: 0, in1000: 0 };
      g.n++;
      if ((t.err ?? Infinity) <= REACH[t.geoPrec ?? GeoPrec.country]) g.ok++;
      if ((t.err ?? Infinity) <= 300) g.in300++;
      if ((t.err ?? Infinity) <= 1000) g.in1000++;
      groups.set(key, g);
    }
  }
  const pc = (n: number, d: number) => `${((100 * n) / d).toFixed(0)}%`;
  const rows = [...groups].sort((a, b) => a[0].localeCompare(b[0])).map(([k, g]) => `| ${k} | ${g.n} | ${pc(g.ok, g.n)} | ${pc(g.in300, g.n)} | ${pc(g.in1000, g.n)} |`);
  return ['| method | precision | placed | within reach | ≤300 km | ≤1000 km |', '|---|---|--:|--:|--:|--:|', ...rows].join('\n');
}

/** Bullet date against Wikidata's for the event it links, by the bullet's precision (Wikidata's must be as fine). */
function dateCheck(d: Record<string, number>, bd: Parameters<typeof bulletTime>[0], wd: [string, number, string?, number?]) {
  const add = (k: string) => (d[k] = (d[k] ?? 0) + 1);
  const [, y, m, day] = wd[0].match(/^(-?\d+)-(\d+)-(\d+)$/)!.map(Number);
  const w = new Date(utc(y, m, day));
  const t = new Date(bulletTime(bd).tStart);
  const sameYear = t.getUTCFullYear() === w.getUTCFullYear();
  const sameMonth = sameYear && t.getUTCMonth() === w.getUTCMonth();
  if (bd.prec === 'day' && wd[1] >= 11) {
    const days = Math.abs(t.getTime() - w.getTime()) / 86_400_000;
    add(days === 0 ? 'day=' : days <= 1 ? 'day±1' : days <= 14 ? 'day±14' : sameMonth ? 'month' : sameYear ? 'year' : 'other year');
  } else if (bd.prec === 'month' && wd[1] >= 10) add(sameMonth ? 'month=' : 'month other');
  else if (bd.prec === 'year' && wd[1] >= 9) add(sameYear ? 'year=' : 'year other');
}

main();
