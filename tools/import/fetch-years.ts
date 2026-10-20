/*
 * Year pages of ten Wikipedias (CC BY-SA): their Events sections as dated bullets with the articles each one links,
 * into RAW_MORE/wikipedia-years/<lang>.json, plus the Wikidata classes that give kinds (classes.json).
 *   npx tsx tools/import/fetch-years.ts [en tr de fr ru es ar fa zh ja] [--reparse]
 *   (fetch.ts years runs every language, or those in YEARS_LANGS=en,tr)
 * Needs the dumps' title indexes and page_props, which tools/import/geo/build-index.ts --fetch-only downloads.
 * Resumable: wikitext and resolved links are cached in .cache/wikipedia-years/<lang>/; a rerun after a network drop
 * fetches only what is missing, and --reparse rebuilds the json from the cache without fetching.
 */
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './context';
import { openGeoIndex } from './geo/geo-index';
import { fetchPages, resolveLinks } from './years/api';
import { fetchEventDates } from './years/event-dates';
import { CLASSES_FILE, YEARS_DIR, type YearsBullet, type YearsFile, type YearsLink, type YearsPage, yearsFile } from './years/file';
import { fetchClassRoots } from './years/kinds';
import { LANG_CODES, LANGS } from './years/langs';
import { offlineItems } from './years/links';
import { parsePage } from './years/parse';
import { listTitles, pageCountries } from './years/titles';

const CACHE = join(REPO, '.cache', 'wikipedia-years');

const isPlace = (geo: NonNullable<ReturnType<typeof openGeoIndex>>, qid: number) => {
  const kind = geo.item(qid)?.kind;
  return !!kind && kind !== 'event';
};
const BATCH = 50;

type CachedPage = { req: string[]; title: string; revid: number; text: string };

/** JSON lines split on "\n" only: readline also breaks at U+2028, which page text holds and JSON leaves raw. */
async function* jsonl<T>(path: string): AsyncGenerator<T> {
  if (!existsSync(path)) return;
  let carry = '';
  const parse = (line: string): T | null => {
    if (!line.trim()) return null;
    // A run killed mid-write leaves a cut last line; its titles are fetched again.
    try {
      return JSON.parse(line) as T;
    } catch {
      console.log(`  ${path}: skipped an unreadable line`);
      return null;
    }
  };
  for await (const chunk of createReadStream(path, { encoding: 'utf8', highWaterMark: 1 << 22 })) {
    const parts = (carry + (chunk as string)).split('\n');
    carry = parts.pop() ?? '';
    for (const line of parts) {
      const v = parse(line);
      if (v !== null) yield v;
    }
  }
  const v = parse(carry);
  if (v !== null) yield v;
}

const jsonLine = (v: unknown) => JSON.stringify(v).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

async function titlesOf(lang: string, dir: string, geo: ReturnType<typeof openGeoIndex>) {
  const path = join(dir, 'titles.json');
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as string[];
  const { titles, notCountry } = await listTitles(lang, geo);
  writeFileSync(path, JSON.stringify(titles));
  const top = Object.entries(notCountry).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([x, n]) => `${x} ${n}`);
  console.log(`${lang}: ${titles.length} titles${top.length ? `; "<year> in X" left out (not a country): ${top.join(', ')}…` : ''}`);
  return titles;
}

async function fetchMissing(lang: string, dir: string, titles: string[]) {
  const pagesPath = join(dir, 'pages.jsonl');
  const missingPath = join(dir, 'missing.jsonl');
  const done = new Set<string>();
  for await (const p of jsonl<CachedPage>(pagesPath)) for (const r of p.req) done.add(r);
  for await (const m of jsonl<{ req: string }>(missingPath)) done.add(m.req);
  const todo = titles.filter(t => !done.has(t));
  console.log(`${lang}: ${done.size} titles cached, ${todo.length} to fetch`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const r = await fetchPages(lang, batch);
    const reqs = new Map<string, string[]>();
    for (const t of batch) reqs.set(r.redirects[t], [...(reqs.get(r.redirects[t]) ?? []), t]);
    appendFileSync(pagesPath, r.pages.map(p => jsonLine({ req: reqs.get(p.title) ?? [], ...p })).join('\n') + (r.pages.length ? '\n' : ''));
    if (r.missing.length) appendFileSync(missingPath, r.missing.map(req => jsonLine({ req })).join('\n') + '\n');
    if ((i / BATCH) % 20 === 0) console.log(`  ${lang}: ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
}

/** Every cached page once, the latest revision, parsed. */
async function parseAll(lang: string, dir: string, geo: ReturnType<typeof openGeoIndex>) {
  const L = LANGS[lang];
  const latest = new Map<string, CachedPage>();
  for await (const p of jsonl<CachedPage>(join(dir, 'pages.jsonl'))) if ((latest.get(p.title)?.revid ?? -1) < p.revid) latest.set(p.title, p);
  const pages: YearsPage[] = [];
  const raw: { p: number; s: string[]; t: string; l: string[]; a?: string[]; c?: string[]; d: YearsBullet['d']; bare?: boolean }[] = [];
  const stats = { pages: latest.size, notYearPage: 0, noEvents: 0, withEvents: 0, bullets: 0, skipped: {} as Record<string, number> };
  for (const page of [...latest.values()].sort((a, b) => a.title.localeCompare(b.title))) {
    const pt = L.page(page.title);
    if (!pt) {
      stats.notYearPage++;
      continue;
    }
    const countries = pt.country !== undefined ? pageCountries(geo, pt.country) : null;
    if (pt.country !== undefined && !countries) {
      stats.notYearPage++;
      continue;
    }
    const r = parsePage(L, page.text, pt);
    for (const [k, n] of Object.entries(r.skipped)) stats.skipped[k] = (stats.skipped[k] ?? 0) + n;
    if (!r.events) {
      stats.noEvents++;
      continue;
    }
    stats.withEvents++;
    const p = pages.length;
    pages.push({
      title: page.title, revid: page.revid, year: pt.year, span: pt.span,
      ...(pt.country !== undefined ? { country: pt.country, countries: countries! } : {}),
      ...(pt.portal ? { portal: [pt.portal.month + 1, pt.portal.day] as [number, number] } : {}),
    });
    for (const b of r.bullets) raw.push({ p, s: b.sec, t: b.text, l: b.links, a: b.loc, ...(b.ctx ? { c: b.ctx } : {}), d: b.date, bare: b.bare });
  }
  stats.bullets = raw.length;
  return { pages, raw, stats };
}

async function resolveAll(lang: string, dir: string, titles: Set<string>): Promise<Map<string, YearsLink>> {
  const path = join(dir, 'links.jsonl');
  const known = new Map<string, YearsLink>();
  for await (const l of jsonl<YearsLink>(path)) known.set(l.t, l);
  const need = new Set([...titles].filter(t => !known.has(t) && !/[[\]{}|<>]/.test(t)));
  if (need.size) {
    const offline = await offlineItems(lang, need);
    const rows = [...offline].map(([t, q]) => ({ t, q }));
    if (rows.length) appendFileSync(path, rows.map(r => jsonLine(r)).join('\n') + '\n');
    for (const r of rows) {
      known.set(r.t, r);
      need.delete(r.t);
    }
  }
  const todo = [...need];
  console.log(`${lang}: ${known.size} links resolved, ${todo.length} to ask the API`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const res = await resolveLinks(lang, todo.slice(i, i + BATCH));
    const rows: YearsLink[] = Object.entries(res).map(([t, r]) => (r ? { t, ...(r.to !== t ? { to: r.to } : {}), ...(r.qid ? { q: r.qid } : {}) } : { t, x: 1 }));
    appendFileSync(path, rows.map(r => jsonLine(r)).join('\n') + '\n');
    for (const r of rows) known.set(r.t, r);
    if ((i / BATCH) % 50 === 0) console.log(`  ${lang} links: ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
  return known;
}

export async function fetchYears(lang: string, opts: { reparse?: boolean } = {}) {
  if (!LANGS[lang]) throw new Error(`no year-page rules for ${lang}`);
  const dir = join(CACHE, lang);
  mkdirSync(dir, { recursive: true });
  mkdirSync(YEARS_DIR, { recursive: true });
  const geo = openGeoIndex();
  try {
    if (!opts.reparse) await fetchMissing(lang, dir, await titlesOf(lang, dir, geo));
    const { pages, raw, stats } = await parseAll(lang, dir, geo);
    const known = await resolveAll(lang, dir, new Set(raw.flatMap(b => [...b.l, ...(b.c ?? [])])));
    const links: YearsLink[] = [];
    const at = new Map<string, number>();
    const idx = (t: string) => {
      let i = at.get(t);
      if (i === undefined) {
        i = links.length;
        at.set(t, i);
        links.push(known.get(t) ?? { t, x: 1 });
      }
      return i;
    };
    const bullets: YearsBullet[] = raw.map(b => ({ p: b.p, ...(b.s.length ? { s: b.s.join(' > ') } : {}), t: b.t, l: b.l.map(idx), ...(b.a ? { a: b.a.map(idx) } : {}), ...(b.c ? { c: b.c.map(idx) } : {}), d: b.d, ...(b.bare ? { b: 1 as const } : {}) }));
    // Wikidata's dates for every linked item that isn't a place: the events among them, to tell a bullet about one from a mention.
    if (geo) await fetchEventDates(links.filter(l => l.q && !l.x && !isPlace(geo, Number(l.q.slice(1)))).map(l => l.q!));
    const out: YearsFile = { lang, fetched: new Date().toISOString().slice(0, 10), stats, pages, links, bullets };
    writeFileSync(yearsFile(lang), JSON.stringify(out));
    console.log(`${lang}: ${stats.pages} pages (${stats.withEvents} with events, ${stats.noEvents} without, ${stats.notYearPage} not year pages), ${bullets.length} bullets, ${links.length} links`);
  } finally {
    geo?.close();
  }
}

/** Subclass closures of the event classes that map to TAKIP kinds; fetched once, small. */
async function classes() {
  if (existsSync(CLASSES_FILE)) return;
  mkdirSync(YEARS_DIR, { recursive: true });
  const roots = await fetchClassRoots();
  writeFileSync(CLASSES_FILE, JSON.stringify(roots));
  console.log(`classes: ${Object.keys(roots).length} event classes`);
}

/** fetch.ts entry: every language, or YEARS_LANGS. */
export async function years() {
  await classes();
  for (const lang of process.env.YEARS_LANGS?.split(',').map(s => s.trim()).filter(Boolean) ?? LANG_CODES) await fetchYears(lang);
}

if (process.argv[1]?.endsWith('fetch-years.ts')) {
  const args = process.argv.slice(2);
  const langs = args.filter(a => !a.startsWith('--'));
  (async () => {
    await classes();
    for (const lang of langs.length ? langs : LANG_CODES) await fetchYears(lang, { reparse: args.includes('--reparse') });
  })().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
