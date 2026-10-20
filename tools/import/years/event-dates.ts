import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UA } from '../fetch-net';
import { YEARS_DIR } from './file';

/*
 * Wikidata's dates for the events bullets link (point in time, else start and end, with their precision), so a bullet
 * that mentions an event of another day ("a trial over the 2004 murder") isn't placed or merged as that event.
 */

export const EVENT_DATES_FILE = join(YEARS_DIR, 'event-dates.json');

/** Q-id → [start, its Wikidata precision, end?, its precision?] as "YYYY-MM-DD" (astronomical years), or null for none. */
export type EventDates = Record<string, [string, number, string?, number?] | null>;

const PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/> PREFIX p: <http://www.wikidata.org/prop/> PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX wikibase: <http://wikiba.se/ontology#>`;
const CHUNK = 2000;

async function qlever(query: string): Promise<{ item: { value: string }; p: { value: string }; t: { value: string }; pr: { value: string } }[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch('https://qlever.dev/api/wikidata', {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: `${PREFIXES} ${query}` }),
        signal: AbortSignal.timeout(300_000),
      });
      if (!res.ok) throw new Error(`qlever ${res.status}`);
      return ((await res.json()) as { results: { bindings: never[] } }).results.bindings;
    } catch (e) {
      if (attempt >= 8) throw e;
      console.log(`  qlever: ${(e as Error).message}; retrying in ${30 * attempt} s`);
      await new Promise(r => setTimeout(r, 30_000 * attempt));
    }
  }
}

/** "-0331-03-01T00:00:00Z" → "-331-03-01": RDF times are astronomical (-331 is 332 BCE), as utc() takes them. */
function day(v: string): string | null {
  const m = v.match(/^(-?)(\d+)-(\d\d)-(\d\d)/);
  return m ? `${Number(m[2]) * (m[1] ? -1 : 1)}-${m[3]}-${m[4]}` : null;
}

/** Adds the dates of `qids` not yet in the file; one QLever query per 2,000. */
export async function fetchEventDates(qids: Iterable<string>, log: (s: string) => void = console.log) {
  const have: EventDates = existsSync(EVENT_DATES_FILE) ? (JSON.parse(readFileSync(EVENT_DATES_FILE, 'utf8')) as EventDates) : {};
  const todo = [...new Set(qids)].filter(q => /^Q\d+$/.test(q) && !(q in have)).sort();
  for (let i = 0; i < todo.length; i += CHUNK) {
    const chunk = todo.slice(i, i + CHUNK);
    const rows = await qlever(`SELECT ?item ?p ?t ?pr WHERE {
      VALUES ?item { ${chunk.map(q => `wd:${q}`).join(' ')} } VALUES (?p ?psv) { (p:P585 psv:P585) (p:P580 psv:P580) (p:P582 psv:P582) }
      ?item ?p ?st . ?st ?psv ?node . ?node wikibase:timeValue ?t ; wikibase:timePrecision ?pr }`);
    const got: Record<string, Record<string, [string, number]>> = {};
    for (const r of rows) {
      const q = r.item.value.replace('http://www.wikidata.org/entity/', '');
      const prop = r.p.value.replace('http://www.wikidata.org/prop/', '');
      const d = day(r.t.value);
      const pr = Number(r.pr.value);
      // The finest of several statements.
      if (d && (!got[q]?.[prop] || got[q][prop][1] < pr)) (got[q] ??= {})[prop] = [d, pr];
    }
    for (const q of chunk) {
      const g = got[q];
      const start = g?.P585 ?? g?.P580;
      have[q] = start ? [start[0], start[1], ...(g?.P582 && !g.P585 ? g.P582 : [])] as [string, number, string?, number?] : null;
    }
    log(`  event dates: ${Math.min(i + CHUNK, todo.length)}/${todo.length}`);
    writeFileSync(EVENT_DATES_FILE, JSON.stringify(have));
  }
  return have;
}

export const readEventDates = (): EventDates => (existsSync(EVENT_DATES_FILE) ? (JSON.parse(readFileSync(EVENT_DATES_FILE, 'utf8')) as EventDates) : {});
