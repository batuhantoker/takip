import { existsSync, readFileSync } from 'node:fs';
import type Database from 'better-sqlite3';
import { normName } from '../../names';
import { titleBase } from '../names';
import { namespacesPath, WIKI_FILES, WIKIS, wikiPath } from './sources';
import { commandLines, sqlDumpRows } from './sql-dump';

type Geo = { lon: number; lat: number; dim: number | null; type: string | null; qid?: number; title?: string; sole?: boolean };

/**
 * Primary Earth coordinates by page id, the first primary tag winning. A page with no primary tag but exactly one
 * other Earth tag keeps that one: arwiki marks almost every article coordinate secondary, and some event articles
 * carry only an inline one.
 */
async function geoTags(path: string) {
  const pages = new Map<number, Geo>();
  const others = new Map<number, Geo | null>();
  for await (const r of sqlDumpRows(path, ['gt_page_id', 'gt_globe', 'gt_primary', 'gt_lat', 'gt_lon', 'gt_dim', 'gt_type'])) {
    const page = r.gt_page_id as number;
    if ((r.gt_globe !== 'earth' && r.gt_globe !== '') || pages.has(page)) continue;
    const lat = Number(r.gt_lat);
    const lon = Number(r.gt_lon);
    if (r.gt_lat === null || r.gt_lon === null || !(Math.abs(lat) <= 90 && Math.abs(lon) <= 180) || (lat === 0 && lon === 0)) continue;
    const g = { lon, lat, dim: typeof r.gt_dim === 'number' ? r.gt_dim : null, type: r.gt_type ? String(r.gt_type) : null };
    if (r.gt_primary === 1) pages.set(page, g);
    else others.set(page, others.has(page) ? null : { ...g, sole: true });
  }
  for (const [page, g] of others) if (g && !pages.has(page)) pages.set(page, g);
  return pages;
}

/** Lower-cased prefixes of every namespace but the articles', in the wiki's language and English. */
function namespacePrefixes(wiki: string): Set<string> {
  if (!existsSync(namespacesPath(wiki))) return new Set();
  const q = (JSON.parse(readFileSync(namespacesPath(wiki), 'utf8')) as {
    query: { namespaces: Record<string, { id: number; name: string; canonical?: string }>; namespacealiases: { id: number; alias: string }[] };
  }).query;
  const names = [
    ...Object.values(q.namespaces).filter(n => n.id !== 0).flatMap(n => [n.name, n.canonical ?? '']),
    ...q.namespacealiases.filter(a => a.id !== 0).map(a => a.alias),
  ];
  return new Set(names.filter(Boolean).map(n => n.toLowerCase()));
}

async function loadWiki(db: Database.Database, wiki: string, log: (s: string) => void) {
  const pages = await geoTags(wikiPath(wiki, 'geo_tags.sql.gz'));
  const prefixes = namespacePrefixes(wiki);
  if (existsSync(wikiPath(wiki, 'page_props.sql.gz'))) {
    for await (const r of sqlDumpRows(wikiPath(wiki, 'page_props.sql.gz'), ['pp_page', 'pp_propname', 'pp_value'])) {
      if (r.pp_propname !== 'wikibase_item') continue;
      const g = pages.get(r.pp_page as number);
      const m = g && String(r.pp_value).match(/^Q(\d+)$/);
      if (m) g.qid = Number(m[1]);
    }
  }
  if (existsSync(wikiPath(wiki, 'pages-articles-multistream-index.txt.bz2'))) {
    for await (const line of commandLines('bzip2', ['-dc', wikiPath(wiki, 'pages-articles-multistream-index.txt.bz2')])) {
      const a = line.indexOf(':');
      const b = line.indexOf(':', a + 1);
      const id = Number(line.slice(a + 1, b));
      const g = pages.get(id);
      if (!g) continue;
      const title = line.slice(b + 1);
      const colon = title.indexOf(':');
      if (colon > 0 && prefixes.has(title.slice(0, colon).toLowerCase())) pages.delete(id);
      else g.title = title;
    }
  }
  const insert = db.prepare(`INSERT OR REPLACE INTO article (wiki, page_id, qid, title, name_norm, qualified, lon, lat, dim, type, sole) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let n = 0;
  let withQid = 0;
  const rows = [...pages];
  const tx = db.transaction((chunk: [number, Geo][]) => {
    for (const [page, g] of chunk) {
      // Pages without an item are mostly outside the article namespace (files, lists of coordinates).
      if (g.qid === undefined && !g.title) continue;
      const t = g.title ? titleBase(g.title) : null;
      insert.run(wiki, page, g.qid ?? null, g.title ?? null, t ? normName(t.base) || null : null, t?.qualified ? 1 : 0, g.lon, g.lat, g.dim, g.type, g.sole ? 1 : 0);
      n++;
      if (g.qid !== undefined) withQid++;
    }
  });
  for (let i = 0; i < rows.length; i += 50_000) tx(rows.slice(i, i + 50_000));
  log(`  ${wiki}: ${n} articles with coordinates (${withQid} with an item)`);
  return n;
}

export async function loadWikipedia(db: Database.Database, log: (s: string) => void): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const done = db.prepare(`SELECT value FROM meta WHERE key = ?`).pluck();
  const mark = db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`);
  for (const wiki of WIKIS) {
    const prev = done.get(`wiki:${wiki}`) as string | undefined;
    if (prev) {
      counts[wiki] = Number(prev);
      continue;
    }
    if (WIKI_FILES.some(f => !existsSync(wikiPath(wiki, f)))) {
      log(`  ${wiki}: downloads incomplete, skipped`);
      counts.incomplete = 1;
      continue;
    }
    db.prepare(`DELETE FROM article WHERE wiki = ?`).run(wiki);
    counts[wiki] = await loadWiki(db, wiki, log);
    mark.run(`wiki:${wiki}`, String(counts[wiki]));
  }
  return counts;
}
