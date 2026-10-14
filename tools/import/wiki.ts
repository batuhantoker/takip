import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './context';
import { readCsv } from './csv';

/** Checked-in `record,title` tables: each source's records and the Wikipedia article about them. */
export const WIKI_DIR = join(REPO, 'tools/import/datasets/wiki');

/** The article title in an en.wikipedia.org page URL, as Wikipedia shows it; null for any other URL. */
export function enwikiTitle(url: string | null | undefined): string | null {
  const m = url?.match(/^https?:\/\/en\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, ' ').trim() || null;
  } catch {
    return null;
  }
}

/** A source's table, record → title. A missing file is an empty table. */
export async function readWikiTable(name: string, dir = WIKI_DIR): Promise<Map<string, string>> {
  const path = join(dir, `${name}.csv`);
  const out = new Map<string, string>();
  if (!existsSync(path)) return out;
  for (const r of await readCsv(path)) {
    if (!r.record || !r.title) throw new Error(`${name}.csv: a row without record or title`);
    if (out.has(r.record)) throw new Error(`${name}.csv: ${r.record} twice`);
    out.set(r.record, r.title);
  }
  return out;
}

export const wikiTablePath = (name: string, dir = WIKI_DIR) => join(dir, `${name}.csv`);

/** attrs.wiki: an English title as is, another Wikipedia's as "fr:Titre" (read by src/lib/history/wiki.ts articleRef). */
export const wikiRef = (lang: string, title: string) => (lang === 'en' ? title : `${lang}:${title}`);

/** Wikipedias tried in this order for an item with no English article; then the first by code. */
const OTHER_LANGS = ['fr', 'de', 'es', 'it', 'pt', 'pl', 'ru'];

/** One of an item's articles, from its sitelinks ({ wiki code: title }); the popup offers the other languages. */
export function otherArticle(links: Record<string, string> | undefined): string | null {
  if (!links) return null;
  const lang = OTHER_LANGS.find(l => links[l]) ?? Object.keys(links).sort()[0];
  return lang ? wikiRef(lang, links[lang]) : null;
}
