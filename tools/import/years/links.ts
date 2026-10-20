import { existsSync } from 'node:fs';
import { wikiPath } from '../geo/build/sources';
import { commandLines, sqlDumpRows } from '../geo/build/sql-dump';

/*
 * Link titles → Wikidata items from the wiki's own dumps (title index and page_props, downloaded for the geo index):
 * millions of lookups the API would take days for. Redirects and pages newer than the dump have no item there and go
 * to the API (`resolveLinks`).
 */

export async function offlineItems(lang: string, titles: Set<string>, log: (s: string) => void = console.log): Promise<Map<string, string>> {
  const index = wikiPath(lang, 'pages-articles-multistream-index.txt.bz2');
  const props = wikiPath(lang, 'page_props.sql.gz');
  const out = new Map<string, string>();
  if (!existsSync(index) || !existsSync(props)) {
    log(`  ${lang}: no dump title index or page_props; every link goes to the API`);
    return out;
  }
  const byPage = new Map<number, string>();
  for await (const line of commandLines('bzip2', ['-dc', index])) {
    const a = line.indexOf(':');
    const b = line.indexOf(':', a + 1);
    const title = line.slice(b + 1);
    if (titles.has(title)) byPage.set(Number(line.slice(a + 1, b)), title);
  }
  for await (const r of sqlDumpRows(props, ['pp_page', 'pp_propname', 'pp_value'])) {
    if (r.pp_propname !== 'wikibase_item') continue;
    const title = byPage.get(r.pp_page as number);
    if (title && /^Q\d+$/.test(String(r.pp_value))) out.set(title, String(r.pp_value));
  }
  log(`  ${lang}: ${byPage.size} of ${titles.size} link titles in the dump, ${out.size} with an item`);
  return out;
}
