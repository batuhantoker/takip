// Each country's Muslim share of its population, for which places get prayer-time and Ramadan pages
// (src/lib/platform/site/places/topics/faith-reach.ts). Writes data/site/topics/muslim-share.json, keyed by ISO2.
//
//   nice npx tsx tools/site/topics/muslim-share.ts
//
// From the table in English Wikipedia's "Islam by country" (CC BY-SA 4.0), whose figures are mostly Pew Research
// Center's.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TAKIP_USER_AGENT } from '../../../src/lib/core/net/user-agent';
import type { GazetteerFile } from '../../../src/lib/platform/site/places/place';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';

const PAGE = 'Islam_by_country';
const API = `https://en.wikipedia.org/w/api.php?action=parse&page=${PAGE}&prop=text|revid&section=4&format=json&formatversion=2`;

/** Wikipedia's names that Intl's English region names don't match. */
const ALIASES: Record<string, string> = {
  'Bosnia and Herzegovina': 'BA', 'Brunei': 'BN', 'Cape Verde': 'CV', 'Czech Republic': 'CZ', 'DR Congo': 'CD',
  'Democratic Republic of the Congo': 'CD', 'Republic of the Congo': 'CG', 'Congo': 'CG', 'East Timor': 'TL', 'Eswatini': 'SZ',
  'Ivory Coast': 'CI', 'Kosovo': 'XK', 'Macau': 'MO', 'Micronesia': 'FM', 'Myanmar': 'MM', 'North Korea': 'KP',
  'Palestine': 'PS', 'State of Palestine': 'PS', 'Russia': 'RU', 'South Korea': 'KR', 'Syria': 'SY', 'Taiwan': 'TW',
  'Vatican City': 'VA', 'Vietnam': 'VN', 'United States': 'US', 'United Kingdom': 'GB', 'Laos': 'LA', 'Iran': 'IR',
  'Moldova': 'MD', 'Tanzania': 'TZ', 'Bolivia': 'BO', 'Venezuela': 'VE', 'Gambia': 'GM', 'The Gambia': 'GM',
  'Bahamas': 'BS', 'The Bahamas': 'BS', 'São Tomé and Príncipe': 'ST', 'Turkey': 'TR', 'Curaçao': 'CW',
  'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC', 'Saint Vincent and the Grenadines': 'VC', 'Hong Kong': 'HK',
  'Federated States of Micronesia': 'FM', 'Netherlands': 'NL', 'Philippines': 'PH', 'Comoros': 'KM', 'Western Sahara': 'EH',
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
// Only the countries the site has: Intl also names retired codes ("DD" is Germany, "CS" Serbia).
const gazetteer = JSON.parse(readFileSync(join('data', 'site', 'gazetteer.json'), 'utf8')) as GazetteerFile;
const byName = new Map(gazetteer.places.filter(p => p.kind === 'country').map(p => [regionNames.of(p.cc) ?? p.cc, p.cc]));

const text = (cell: string) => cell.replace(/<sup[\s\S]*?<\/sup>|<[^>]+>/g, '').replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function main() {
  const res = await fetch(API, { headers: { 'User-Agent': TAKIP_USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);
  const { parse } = (await res.json()) as { parse: { text: string; revid: number } };
  const rows: Record<string, number> = {};
  const missed: string[] = [];
  for (const [, row] of parse.text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(m => text(m[1]));
    const pct = Number.parseFloat((cells[3] ?? '').replace(/[<~]/g, ''));
    if (cells.length < 4 || !Number.isFinite(pct)) continue;
    const name = cells[0].replace(/\s*\(.*\)$/, '');
    const cc = ALIASES[name] ?? byName.get(name);
    if (!cc) { missed.push(name); continue; }
    rows[cc] = pct;
  }
  const table: TopicTable<number, { source: string }> = {
    generated: new Date().toISOString(),
    meta: { source: `https://en.wikipedia.org/w/index.php?title=${PAGE}&oldid=${parse.revid}` },
    rows,
  };
  writeFileSync(join('data', 'site', 'topics', 'muslim-share.json'), `${JSON.stringify(table)}\n`);
  console.log(`${Object.keys(rows).length} countries; unmatched: ${missed.join(', ') || 'none'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
