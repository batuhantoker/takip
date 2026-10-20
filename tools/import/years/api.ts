import { UA } from '../fetch-net';

/* The MediaWiki Action API, one request at a time about a second apart, riding out the network's 20–60 s drops. */

const GAP_MS = 1000;
/** Waits between retries: the network here drops for up to a minute, the API's maxlag for longer. */
const BACKOFF_S = [5, 10, 20, 30, 60, 60, 120, 120, 300, 300, 600];

let last = 0;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Json = Record<string, unknown>;

/** One API GET with retries; throws only on a client error or after about half an hour of failures. */
export async function api(lang: string, params: Record<string, string>, log: (s: string) => void = console.log): Promise<Json> {
  const url = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`;
  for (let attempt = 0; ; attempt++) {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    let why: string;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' }, signal: AbortSignal.timeout(120_000) });
      if (res.ok) {
        const body = (await res.json()) as Json & { error?: { code?: string; info?: string } };
        if (!body.error) return body;
        if (body.error.code !== 'maxlag' && body.error.code !== 'ratelimited') throw new Error(`${lang} API: ${body.error.code} ${body.error.info}`);
        why = body.error.code;
      } else {
        if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url.slice(0, 200)}`);
        why = String(res.status);
      }
    } catch (e) {
      if (e instanceof Error && /^\d{3} |API:/.test(e.message)) throw e;
      why = e instanceof Error ? e.message : String(e);
    }
    if (attempt >= BACKOFF_S.length) throw new Error(`${lang} API: gave up after ${attempt} retries (${why})`);
    log(`  ${lang}: ${why}, retrying in ${BACKOFF_S[attempt]} s`);
    await sleep(BACKOFF_S[attempt] * 1000);
  }
}

/** A query run to `batchcomplete`: big pages come back a few at a time with a `continue` for the rest. */
export async function queryAll(lang: string, params: Record<string, string>, log?: (s: string) => void): Promise<Json[]> {
  const parts: Json[] = [];
  let cont: Record<string, string> = {};
  for (let n = 0; n < 200; n++) {
    const body = await api(lang, { action: 'query', ...params, ...cont }, log);
    parts.push(body);
    if (!body.continue) return parts;
    cont = body.continue as Record<string, string>;
  }
  throw new Error(`${lang}: query did not complete in 200 continuations`);
}

export type Page = { title: string; revid: number; text: string };
export type Fetched = { pages: Page[]; redirects: Record<string, string>; missing: string[] };

const mergeMaps = (parts: Json[], key: 'redirects' | 'normalized' | 'converted') => {
  const out: Record<string, string> = {};
  for (const p of parts) for (const r of ((p.query as Json | undefined)?.[key] as { from: string; to: string }[] | undefined) ?? []) out[r.from] = r.to;
  return out;
};

/** Requested title → the title it ends at, through normalisation, variant conversion and redirects. */
function finalTitles(parts: Json[], titles: string[]): Record<string, string> {
  const norm = mergeMaps(parts, 'normalized');
  const conv = mergeMaps(parts, 'converted');
  const redir = mergeMaps(parts, 'redirects');
  const out: Record<string, string> = {};
  for (const t of titles) {
    let x = norm[t] ?? t;
    x = conv[x] ?? x;
    for (let k = 0; k < 5 && redir[x]; k++) x = redir[x];
    out[t] = x;
  }
  return out;
}

/** Up to 50 titles' current wikitext, following redirects. */
export async function fetchPages(lang: string, titles: string[], log?: (s: string) => void): Promise<Fetched> {
  const parts = await queryAll(lang, { prop: 'revisions', rvprop: 'content|ids', rvslots: 'main', redirects: '1', ...(lang === 'zh' ? { converttitles: '1' } : {}), titles: titles.join('|') }, log);
  const pages = new Map<string, Page>();
  const missing = new Set<string>();
  for (const p of parts) {
    type P = { title: string; missing?: boolean; invalid?: boolean; revisions?: { revid: number; slots: { main: { content: string } } }[] };
    for (const pg of ((p.query as Json | undefined)?.pages as P[] | undefined) ?? []) {
      if (pg.missing || pg.invalid) missing.add(pg.title);
      else if (pg.revisions?.[0]) pages.set(pg.title, { title: pg.title, revid: pg.revisions[0].revid, text: pg.revisions[0].slots.main.content });
    }
  }
  const final = finalTitles(parts, titles);
  return { pages: [...pages.values()], redirects: final, missing: titles.filter(t => missing.has(final[t]) || (!pages.has(final[t]) && !missing.has(final[t]))) };
}

export type Resolved = { to: string; qid: string | null } | null;

/** Up to 50 link titles → the article they end at and its Wikidata item; null for a missing page. */
export async function resolveLinks(lang: string, titles: string[], log?: (s: string) => void): Promise<Record<string, Resolved>> {
  const parts = await queryAll(lang, { prop: 'pageprops', ppprop: 'wikibase_item', redirects: '1', ...(lang === 'zh' ? { converttitles: '1' } : {}), titles: titles.join('|') }, log);
  const items = new Map<string, string | null>();
  for (const p of parts) {
    type P = { title: string; missing?: boolean; invalid?: boolean; pageprops?: { wikibase_item?: string } };
    for (const pg of ((p.query as Json | undefined)?.pages as P[] | undefined) ?? []) {
      if (pg.missing || pg.invalid) continue;
      if (!items.has(pg.title) || pg.pageprops?.wikibase_item) items.set(pg.title, pg.pageprops?.wikibase_item ?? null);
    }
  }
  const final = finalTitles(parts, titles);
  return Object.fromEntries(titles.map(t => [t, items.has(final[t]) ? { to: final[t], qid: items.get(final[t]) ?? null } : null]));
}
