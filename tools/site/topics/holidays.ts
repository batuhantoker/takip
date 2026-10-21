// Which countries' public holidays the place pages show, and how far to trust them: for each country whose rules
// check out, its weekend, time zone, whether its regional holidays are listed, and an official list's corrections.
// The dates are worked out from date-holidays' rules when a page renders (holidays-rules.ts). Writes
// data/site/topics/holidays.json (src/lib/platform/site/places/topics/holidays-data.ts). Rebuild it each year, so
// the years checked move with the years the pages index.
//
//   nice npx tsx tools/site/topics/holidays.ts
//
// A country is kept where its dates match an official list (GOV.UK's JSON and Japan's Cabinet Office CSV, read
// here; OPM, service-public.gouv.fr, Diyanet, Mexico's Ley Federal del Trabajo and Sweden's holiday act, checked by
// hand on 2026-10-21) or Nager.Date's (MIT) for the build year and the two after, weekday by weekday; its regional
// holidays are kept only if their regions match too. Downloads are cached in .cache/site/holidays.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TAKIP_USER_AGENT } from '../../../src/lib/core/net/user-agent';
import type { GazetteerFile } from '../../../src/lib/platform/site/places/place';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import { chinaYear } from '../../../src/lib/platform/site/places/topics/holidays-china';
import type { HolidayEntry, HolidayMeta, HolidayPatch, HolidayRow } from '../../../src/lib/platform/site/places/topics/holidays-data';
import { HOLIDAY_INDEX, yearFacts } from '../../../src/lib/platform/site/places/topics/holidays-facts';
import { addDays, buildYear, holidaysOf, isoDay, ruleCountries, stateNames, type BuiltYear } from '../../../src/lib/platform/site/places/topics/holidays-rules';
import type { IssRow } from '../../../src/lib/platform/site/places/topics/sky-data';

const CACHE = join('.cache', 'site', 'holidays');
const OUT = join('data', 'site', 'topics', 'holidays.json');
const BUILD_YEAR = new Date().getUTCFullYear();
const CHECK_YEARS = [0, 1, 2].map(d => BUILD_YEAR + d);
/** The pages render ten years either side of the clock's; corrections cover that for a year or two after the build. */
const PATCH_YEARS = { from: BUILD_YEAR - 11, to: BUILD_YEAR + 12 };
const RULES_VERSION = (JSON.parse(readFileSync(join('node_modules', 'date-holidays', 'package.json'), 'utf8')) as { version: string }).version;

/** Checked by hand against the official list for 2026 and 2027. */
const VERIFIED: Record<string, { official: string; url: string }> = {
  US: { official: 'OPM', url: 'https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/' },
  GB: { official: 'GOV.UK', url: 'https://www.gov.uk/bank-holidays' },
  JP: { official: '内閣府', url: 'https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html' },
  TR: { official: 'Diyanet, 2429 sayılı Kanun', url: 'https://www.mevzuat.gov.tr/mevzuatmetin/1.5.2429.pdf' },
  FR: { official: 'Service-Public.fr', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2405' },
  MX: { official: 'Ley Federal del Trabajo, art. 74', url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf' },
  SE: { official: 'Lag (1989:253) om allmänna helgdagar', url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1989253-om-allmanna-helgdagar_sfs-1989-253/' },
  CN: { official: '国务院办公厅', url: 'https://www.gov.cn/zhengce/' },
};

/** Days off these countries move or add by decree each year, which no rule can know. */
const LEFT_OUT: Record<string, string> = {
  RU: 'weekends moved by the yearly production-calendar decree', BY: 'weekends moved by yearly decree', KZ: 'weekends moved by yearly decree',
  UA: 'holidays suspended under martial law', EG: 'holidays moved to Thursdays by decree', SA: 'Eid holidays set each year',
  AE: 'Eid holidays set each year by the cabinet',
  AU: 'holidays set state by state; the rules’ national list has days some states don’t keep',
};

/** GOV.UK's divisions, as date-holidays' nations. */
const GOV_UK: Record<string, string[]> = { 'england-and-wales': ['ENG', 'WLS'], scotland: ['SCT'], 'northern-ireland': ['NIR'] };

/** The cached download's path; Nager answers 204 for a country it doesn't cover, kept as an empty file so it isn't asked again. */
async function download(file: string, url: string): Promise<string> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    const res = await fetch(url, { headers: { 'User-Agent': TAKIP_USER_AGENT } });
    if (!res.ok && res.status !== 404) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(path, res.ok ? Buffer.from(await res.arrayBuffer()) : '');
    await new Promise(r => setTimeout(r, 250));
  }
  return path;
}

async function cached(file: string, url: string): Promise<string | null> {
  const body = readFileSync(await download(file, url), 'utf8');
  return body.trim() ? body : null;
}

function weekendOf(cc: string): number[] {
  const loc = new Intl.Locale(`und-${cc}`) as Intl.Locale & { getWeekInfo?: () => { weekend: number[] }; weekInfo?: { weekend: number[] } };
  return (loc.getWeekInfo?.() ?? loc.weekInfo)?.weekend ?? [6, 7];
}

/** Every full day off a list gives on the working days of the week. */
function weekdaysOff(list: HolidayEntry[], weekend: number[], year: number): Set<string> {
  const out = new Set<string>();
  for (const e of list) {
    if (e.t !== 'p' || e.from) continue;
    for (let i = 0; i < (e.n ?? 1); i++) {
      const d = addDays(e.d, i);
      if (d.startsWith(String(year)) && !weekend.includes(isoDay(d))) out.add(d);
    }
  }
  return out;
}

function regionalWeekdays(b: BuiltYear, weekend: number[], year: number): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const { e, regions } of b.regional) {
    for (const d of weekdaysOff([e], weekend, year)) {
      const held = out.get(d) ?? new Set<string>();
      for (const r of regions) held.add(r);
      out.set(d, held);
    }
  }
  return out;
}

/** Nager's list for a year: weekday days off everywhere, and each regional one's regions. */
async function nagerYear(cc: string, year: number, weekend: number[]) {
  const body = await cached(join('nager', `${cc}-${year}.json`), `https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`);
  if (!body) return null;
  const list = JSON.parse(body) as { date: string; global: boolean; counties: string[] | null; types: string[] }[];
  const national = new Set<string>();
  const regional = new Map<string, Set<string>>();
  for (const e of list) {
    if (!e.types.includes('Public') || weekend.includes(isoDay(e.date))) continue;
    if (e.global || !e.counties?.length) national.add(e.date);
    else for (const c of e.counties) (regional.get(e.date) ?? regional.set(e.date, new Set()).get(e.date)!).add(c.replace(/^[A-Z]{2}-/, ''));
  }
  return { national, regional };
}

const sameSet = <T>(a: Set<T>, b: Set<T>) => a.size === b.size && [...a].every(x => b.has(x));

/** GOV.UK's corrections to the rules, by year: days it adds to a nation, and weekdays off it doesn't have. */
function govUkPatches(govUk: Record<string, { events: { title: string; date: string }[] }>): Record<string, HolidayPatch> {
  const out: Record<string, HolidayPatch> = {};
  for (let year = PATCH_YEARS.from; year <= PATCH_YEARS.to; year++) {
    const patch: HolidayPatch = {};
    for (const [division, nations] of Object.entries(GOV_UK)) {
      const events = govUk[division].events.filter(e => e.date.startsWith(String(year)));
      if (!events.length) continue;
      const official = new Set(events.map(e => e.date));
      for (const region of nations) {
        const ours = weekdaysOff(holidaysOf('GB', region, year), [6, 7], year);
        for (const e of events) if (!ours.has(e.date)) (patch.add ??= []).push({ region, d: e.date, name: e.title });
        for (const d of ours) if (!official.has(d)) (patch.drop ??= []).push({ region, d });
      }
    }
    if (patch.add || patch.drop) {
      out[year] = patch;
      console.log(`  GB ${year}: adds ${patch.add?.map(a => `${a.region} ${a.d} ${a.name}`).join(', ') || '-'}; drops ${patch.drop?.map(a => `${a.region} ${a.d}`).join(', ') || '-'}`);
    }
  }
  return out;
}

async function main() {
  mkdirSync(join(CACHE, 'nager'), { recursive: true });
  const gaz = JSON.parse(readFileSync(join('data', 'site', 'gazetteer.json'), 'utf8')) as GazetteerFile;
  const zones = (JSON.parse(readFileSync(join('data', 'site', 'topics', 'iss.json'), 'utf8')) as TopicTable<IssRow>).rows;
  const countries = new Map(gaz.places.filter(p => p.kind === 'country').map(p => [p.cc, p]));
  const zoneOf = new Map<string, { pop: number; tz: string }>();
  for (const p of gaz.places) {
    const tz = p.kind === 'city' ? zones[p.id]?.tz : undefined;
    if (tz && (zoneOf.get(p.cc)?.pop ?? -1) < p.pop) zoneOf.set(p.cc, { pop: p.pop, tz });
  }

  const govUk = JSON.parse((await cached('bank-holidays.json', 'https://www.gov.uk/bank-holidays.json'))!) as Record<string, { events: { title: string; date: string }[] }>;
  const jpCsv = new TextDecoder('shift_jis').decode(readFileSync(await download('syukujitsu.csv', 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv')));
  const jpOfficial = new Map<number, Set<string>>();
  for (const line of jpCsv.split(/\r?\n/).slice(1)) {
    const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2}),/.exec(line);
    if (m) (jpOfficial.get(Number(m[1])) ?? jpOfficial.set(Number(m[1]), new Set()).get(Number(m[1]))!).add(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  }

  const rows: Record<string, HolidayRow> = {};
  const report: string[] = [];
  for (const cc of [...new Set([...ruleCountries(), 'CN'])].sort()) {
    const place = countries.get(cc);
    if (!place) continue;
    if (LEFT_OUT[cc]) { report.push(`${cc} left out: ${LEFT_OUT[cc]}`); continue; }
    const weekend = weekendOf(cc);
    const names = stateNames(cc);
    const patches = cc === 'GB' ? govUkPatches(govUk) : undefined;

    let nationalOk = true;
    let regionalOk = Object.keys(names).length > 0;
    let compared = 0;
    let nagerRegional = false;
    const diffs: string[] = [];
    if (cc !== 'CN') {
      for (const year of CHECK_YEARS) {
        const n = await nagerYear(cc, year, weekend);
        if (!n) continue;
        const b = buildYear(cc, year, patches?.[year]);
        compared++;
        const ours = weekdaysOff(b.national, weekend, year);
        if (!sameSet(ours, n.national)) {
          nationalOk = false;
          diffs.push(`${year} national: ours only ${[...ours].filter(d => !n.national.has(d)).join(',') || '-'}; Nager only ${[...n.national].filter(d => !ours.has(d)).join(',') || '-'}`);
        }
        const regional = regionalWeekdays(b, weekend, year);
        if (n.regional.size) nagerRegional = true;
        for (const d of new Set([...regional.keys(), ...n.regional.keys()])) {
          if (!sameSet(regional.get(d) ?? new Set(), n.regional.get(d) ?? new Set())) {
            regionalOk = false;
            diffs.push(`${year} regional ${d}: ours ${[...regional.get(d) ?? []].join(',') || '-'}; Nager ${[...n.regional.get(d) ?? []].join(',') || '-'}`);
          }
        }
      }
    }
    const skip: number[] = [];
    if (cc === 'JP') {
      for (const [year, official] of jpOfficial) {
        if (year < PATCH_YEARS.from || year > PATCH_YEARS.to) continue;
        const ours = new Set(buildYear(cc, year).national.filter(e => e.t === 'p').map(e => e.d));
        if (!sameSet(ours, official)) {
          skip.push(year);
          diffs.push(`${year} differs from the Cabinet Office CSV (ours only ${[...ours].filter(d => !official.has(d)).join(',') || '-'}; CSV only ${[...official].filter(d => !ours.has(d)).join(',') || '-'}): no page`);
        }
      }
    }
    const verified = VERIFIED[cc];
    if (!verified && !(compared >= 2 && nationalOk)) {
      report.push(`${cc} untrusted (${compared} years compared): ${diffs.slice(0, 3).join(' | ')}`);
      continue;
    }
    // GOV.UK sets the UK's nations; elsewhere regional holidays stand where Nager's regions match.
    const withRegions = Object.keys(names).length > 0 && (regionalOk || cc === 'GB');
    const hasRegional = !withRegions && (nagerRegional || (cc !== 'CN' && CHECK_YEARS.some(y => buildYear(cc, y).regional.length > 0)));
    const row: HolidayRow = {
      cc, tz: zoneOf.get(cc)?.tz ?? 'UTC', weekend,
      ...(withRegions && { regions: names }),
      ...(hasRegional && { regionsLeftOut: 1 as const }),
      ...(patches && Object.keys(patches).length && { patches }),
      ...(skip.length && { skip }),
      checked: verified ? { official: verified.official, url: verified.url } : { nager: 1 },
    };
    if (CHECK_YEARS.some(y => (cc !== 'CN' || chinaYear(y) === 'notice') && (yearFacts(row, y)?.holidays ?? 0) < HOLIDAY_INDEX.nationalDays)) row.thin = 1;
    rows[place.id] = row;
    if (diffs.length || row.thin) report.push(`${cc} ${verified ? `verified (${verified.official})` : 'trusted'}${hasRegional ? ', regions left out' : ''}${row.thin ? ', thin' : ''}: ${diffs.slice(0, 4).join(' | ')}`);
  }

  const table: TopicTable<HolidayRow, HolidayMeta> = {
    generated: new Date().toISOString().slice(0, 10),
    meta: { rules: RULES_VERSION, checked: [CHECK_YEARS[0], CHECK_YEARS[CHECK_YEARS.length - 1]] },
    rows,
  };
  writeFileSync(OUT, `${JSON.stringify(table)}\n`);
  console.log(report.join('\n'));
  const kept = Object.values(rows);
  console.log(`\n${kept.length} countries: ${kept.map(r => r.cc).sort().join(' ')}`);
  console.log(`${OUT}: ${(JSON.stringify(table).length / 1024).toFixed(1)} KB`);
}

main().catch(e => { console.error(e); process.exit(1); });
