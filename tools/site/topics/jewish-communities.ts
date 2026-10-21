// Cities outside Israel with a Jewish community of 10,000 or more, for which places get Shabbat-time pages
// (src/lib/platform/site/places/topics/faith-reach.ts). Writes data/site/topics/jewish-communities.json, keyed by
// GeoNames id; Israel's cities all have pages and aren't listed.
//
//   nice npx tsx tools/site/topics/jewish-communities.ts
//
// From the "by metropolitan area" and "by city proper" tables of English Wikipedia's "Jewish population by city"
// (CC BY-SA 4.0), the larger of the two where a city is in both.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TAKIP_USER_AGENT } from '../../../src/lib/core/net/user-agent';
import type { GazetteerFile, Place } from '../../../src/lib/platform/site/places/place';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import type { JewishCommunityRow } from '../../../src/lib/platform/site/places/topics/faith-reach';

const PAGE = 'Jewish_population_by_city';
const SECTIONS = [1, 2];
const MIN_JEWS = 10_000;

/** Wikipedia's names that aren't the gazetteer city's, folded; a metro area is its main city. */
const ALIASES: Record<string, string> = {
  'washington, d.c.': 'washington', 'san francisco bay area': 'san francisco', 'minneapolis-st paul': 'minneapolis',
  frankfurt: 'frankfurt am main',
};
const COUNTRY_ALIASES: Record<string, string> = { 'United States': 'US', 'United Kingdom': 'GB', Russia: 'RU', Turkey: 'TR' };


const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const text = (cell: string) => cell.replace(/<sup[\s\S]*?<\/sup>|<[^>]+>/g, '').replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

async function section(n: number): Promise<{ html: string; revid: number }> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${PAGE}&prop=text|revid&section=${n}&format=json&formatversion=2`;
  const res = await fetch(url, { headers: { 'User-Agent': TAKIP_USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);
  const { parse } = (await res.json()) as { parse: { text: string; revid: number } };
  return { html: parse.text, revid: parse.revid };
}

async function main() {
  const gazetteer = JSON.parse(readFileSync(join('data', 'site', 'gazetteer.json'), 'utf8')) as GazetteerFile;
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const countries = new Map(gazetteer.places.filter(p => p.kind === 'country').map(p => [regionNames.of(p.cc) ?? p.cc, p.cc]));
  const cities = new Map<string, Place[]>();
  for (const p of gazetteer.places) {
    if (p.kind !== 'city') continue;
    const key = `${p.cc}|${fold(p.name)}`;
    cities.set(key, [...(cities.get(key) ?? []), p]);
  }
  const rows: Record<string, JewishCommunityRow> = {};
  const missed: string[] = [];
  let revid = 0;
  for (const n of SECTIONS) {
    const { html, revid: r } = await section(n);
    revid = r;
    for (const [, row] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(m => text(m[1]));
      const jews = Number((cells[2] ?? '').replace(/[^\d]/g, ''));
      if (cells.length < 3 || !(jews >= MIN_JEWS)) continue;
      const cc = COUNTRY_ALIASES[cells[1]] ?? countries.get(cells[1]);
      if (!cc || cc === 'IL') {
        if (!cc) missed.push(`${cells[0]} (${cells[1]})`);
        continue;
      }
      const name = fold(cells[0]);
      // The most populous city of the name: Portland, Oregon rather than Maine.
      const place = (cities.get(`${cc}|${ALIASES[name] ?? name}`) ?? []).sort((a, b) => b.pop - a.pop)[0];
      if (!place) { missed.push(`${cells[0]} (${cells[1]})`); continue; }
      const held = rows[place.id];
      if (!held || held.jews < jews) rows[place.id] = { jews, name: cells[0] };
    }
  }
  const table: TopicTable<JewishCommunityRow, { source: string; min: string }> = {
    generated: new Date().toISOString(),
    meta: { source: `https://en.wikipedia.org/w/index.php?title=${PAGE}&oldid=${revid}`, min: String(MIN_JEWS) },
    rows,
  };
  writeFileSync(join('data', 'site', 'topics', 'jewish-communities.json'), `${JSON.stringify(table)}\n`);
  console.log(`${Object.keys(rows).length} cities; unmatched: ${missed.join(', ') || 'none'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
