// SPARQL answers for tools/site/build-mountains.ts, each kept as TSV in .cache/site/mountains so a rerun resumes and
// --offline rebuilds from the cache alone. The few queries over every mountain go to QLever, ten seconds apart: it
// answers a quick run from one address with 429s, and other builders here share it. The many small ones over lists
// of ids go to query.wikidata.org, one at a time.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { sparqlTsv } from '../../import/geo/build/download';

const QLEVER = 'https://qlever.dev/api/wikidata';
const WDQS = 'https://query.wikidata.org/sparql';
const PAUSE_MS: Record<string, number> = { [QLEVER]: 10_000, [WDQS]: 1_000 };

export const CACHE = join('.cache', 'site', 'mountains');

class OfflineMiss extends Error {}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** The cached answer's path, fetching it first unless offline. */
export async function cachedTsv(name: string, query: string, offline: boolean, endpoint = QLEVER): Promise<string> {
  const file = join(CACHE, `${name}.tsv`);
  if (existsSync(file)) return file;
  if (offline) throw new OfflineMiss(`not cached: ${name}`);
  if (endpoint === QLEVER) console.log(`  asking QLever: ${name}`);
  await sleep(PAUSE_MS[endpoint]);
  return sparqlTsv(endpoint, query, file);
}

/** A query over a list of ids, in chunks; each chunk is cached under a hash of its ids. */
export async function chunkedTsv(name: string, ids: string[], size: number, query: (chunk: string[]) => string, offline: boolean): Promise<string[]> {
  const files: string[] = [];
  const sorted = [...new Set(ids)].sort();
  for (let i = 0; i < sorted.length; i += size) {
    const chunk = sorted.slice(i, i + size);
    const key = createHash('sha1').update(chunk.join(',')).digest('hex').slice(0, 16);
    files.push(await cachedTsv(`${name}/${key}`, query(chunk), offline, WDQS));
    if ((i / size) % 20 === 19) console.log(`  ${name}: ${Math.min(i + size, sorted.length)}/${sorted.length}`);
  }
  return files;
}

/** A TSV term: an IRI's inside, a literal's text (its language in `lang`), or the bare value. */
export function term(s: string): { value: string; lang?: string } {
  if (s.startsWith('<') && s.endsWith('>')) return { value: s.slice(1, -1) };
  if (!s.startsWith('"')) return { value: s };
  const m = /^"((?:[^"\\]|\\.)*)"(?:@([\w-]+)|\^\^<[^>]*>)?$/.exec(s);
  if (!m) return { value: s };
  const value = m[1].replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c));
  return m[2] ? { value, lang: m[2] } : { value };
}

/** Each row's terms, the header skipped. */
export async function* rows(files: string | string[]): AsyncGenerator<{ value: string; lang?: string }[]> {
  for (const file of Array.isArray(files) ? files : [files]) {
    let header = true;
    for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
      if (header) {
        header = false;
        continue;
      }
      if (line) yield line.split('\t').map(term);
    }
  }
}

export const isOfflineMiss = (e: unknown) => e instanceof OfflineMiss;
