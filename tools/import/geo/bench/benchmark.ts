// Measures the resolver against events whose coordinates are known: hides them, resolves from what a
// coordinate-less event would carry, and reports error per method (docs/architecture/geolocation.md §Benchmark).
//
//   nice npx tsx tools/import/geo/bench/benchmark.ts [--gtd 3000] [--out <dir>]
//
// Reads history.db and catalog.db read-only and geo-index.db.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { GeoPrec } from '@takip/db';
import { km } from '../candidates';
import { SqliteGeoIndex } from '../geo-index';
import { type Evidence, type Method, resolveEvent } from '../resolve';
import { markdown, summarise, type Trial } from './stats';
import { FILES, readRows, readSitelinks, rowEvidence, warPoints, wdPoint } from '../wikidata-evidence';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const OUT = arg('out', join('.cache', 'geo-index', 'benchmark'));
const GTD_SAMPLE = Number(arg('gtd', '3000'));
const PREC_NAME: Record<number, string> = { [GeoPrec.exact]: 'exact', [GeoPrec.city]: 'city', [GeoPrec.area]: 'area', [GeoPrec.approximate]: 'approximate', [GeoPrec.country]: 'country' };

const history = new Database(join('data', 'db', 'history.db'), { readonly: true, fileMustExist: true });
const catalog = new Database(join('data', 'db', 'catalog.db'), { readonly: true, fileMustExist: true });
const index = new SqliteGeoIndex();
const sourceId = (code: string) => catalog.prepare(`SELECT source_id FROM meta_source WHERE code = ?`).pluck().get(code) as number;

type Case = { set: string; id: string; truth: { lon: number; lat: number }; ev: Evidence; withCountry?: Evidence; loc?: { lon: number; lat: number } | null };

function wikidataCases(): Case[] {
  const sitelinks = readSitelinks();
  const wars = warPoints(Object.keys(FILES));
  const cases: Case[] = [];
  for (const [file, source] of Object.entries(FILES)) {
    const truth = new Map((history.prepare(`SELECT source_record_id AS id, lon, lat FROM ev_event WHERE source_id = ? AND geo_prec = 1 AND retracted_at IS NULL AND lon IS NOT NULL`).all(sourceId(source)) as { id: string; lon: number; lat: number }[]).map(r => [r.id, r]));
    for (const r of readRows(file)) {
      const t = truth.get(r.item);
      if (!t) continue;
      cases.push({ set: file, id: r.item, truth: t, ev: rowEvidence(r, sitelinks, wars), withCountry: rowEvidence(r, sitelinks, wars, true), loc: wdPoint(r.locCoord) });
    }
  }
  return cases;
}

/** A deterministic sample of GTD attacks GTD places exactly, with the city, province and country it names. */
function gtdCases(n: number): Case[] {
  const iso2 = catalog.prepare(`SELECT i.value FROM core_entity_identifier i JOIN core_id_scheme s USING (scheme_id) WHERE s.code = 'iso2' AND i.entity_id = ?`).pluck();
  const rows = history.prepare(`
    SELECT e.event_id AS id, e.lon, e.lat, json_extract(e.attrs, '$.city') AS city, json_extract(e.attrs, '$.provstate') AS prov,
           json_extract(e.attrs, '$.summary') AS summary, strftime('%Y', e.t_start / 1000, 'unixepoch') AS year,
           (SELECT ee.entity_id FROM ev_event_entity ee JOIN ev_role r USING (role_id) WHERE ee.event_id = e.event_id AND r.code = 'location' LIMIT 1) AS loc
    FROM ev_event e WHERE e.source_id = ? AND e.geo_prec = 1 AND e.retracted_at IS NULL AND json_extract(e.attrs, '$.city') IS NOT NULL
    ORDER BY (e.event_id * 2654435761) % 4294967296 LIMIT ?`).all(sourceId('gtd'), n) as { id: number; lon: number; lat: number; city: string; prov: string | null; summary: string | null; year: string; loc: number | null }[];
  return rows.filter(r => r.city && r.city !== 'Unknown').map(r => {
    const country = r.loc !== null ? ((iso2.get(r.loc) as string | undefined) ?? null) : null;
    return {
      set: 'gtd', id: String(r.id), truth: r,
      ev: { named: [{ name: r.city, admin1: r.prov, country }], description: r.summary, year: Number(r.year), countries: country ? [country] : [] },
    };
  });
}

/** A cascade run labels each hit `<label>:<method that placed it>`. */
function run(cases: Case[], method: string, opts: { methods?: Method[]; useCountry?: boolean; permissive?: boolean; cascade?: boolean }): Trial[] {
  return cases.map(c => {
    const ev = opts.useCountry ? (c.withCountry ?? c.ev) : c.ev;
    const r = resolveEvent(index, ev, { methods: opts.methods, permissive: opts.permissive });
    return r
      ? { set: c.set, id: c.id, method: opts.cascade ? `${method}:${r.method}` : method, hit: true, err: km(r, c.truth), geoPrec: r.geoPrec, kind: r.kind, evidence: r.evidence, ...(opts.permissive && { features: r.features, detail: r.detail }) }
      : { set: c.set, id: c.id, method, hit: false };
  });
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const wd = wikidataCases();
  const gtd = gtdCases(GTD_SAMPLE);
  console.log(`${wd.length} Wikidata events, ${gtd.length} GTD attacks`);
  const trials: Trial[] = [];
  const tried = new Map<string, number>();
  const count = (key: string, n: number) => tried.set(key, (tried.get(key) ?? 0) + n);

  const single: [string, Method[], boolean?][] = [
    ['article', ['article']],
    ['title-name', ['title-name']],
    ['title-name+country', ['title-name'], true],
    ['description-name', ['description-name']],
    ['related', ['related']],
  ];
  for (const [label, methods, useCountry] of single) {
    const ts = run(wd, label, { methods, useCountry });
    trials.push(...ts);
    for (const c of wd) count(`${c.set}|${label}`, 1);
    console.log(`  ${label}: ${ts.filter(t => t.hit).length}/${ts.length} in ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  // The location item (P276) point the importers fall back to, against the event's own P625.
  trials.push(...wd.map(c => (c.loc ? { set: c.set, id: c.id, method: 'p276-point', hit: true, err: km(c.loc, c.truth), geoPrec: GeoPrec.area } : { set: c.set, id: c.id, method: 'p276-point', hit: false })));
  for (const c of wd) count(`${c.set}|p276-point`, 1);
  trials.push(...run(wd, 'cascade', { methods: ['article', 'title-name', 'description-name', 'related'], cascade: true }));
  for (const c of wd) count(`${c.set}|cascade`, 1);
  // Without the event's own articles, which mostly carry the same point as P625.
  trials.push(...run(wd, 'no-article', { methods: ['title-name', 'description-name', 'related'], cascade: true }));
  for (const c of wd) count(`${c.set}|no-article`, 1);

  for (const [label, methods] of [['named-place', ['named-place']], ['description-name', ['description-name']]] as [string, Method[]][]) {
    trials.push(...run(gtd, label, { methods }));
    count(`gtd|${label}`, gtd.length);
  }
  // Every top candidate with the numbers it was chosen on, to set the acceptance rules from (explore.json).
  const explore = [
    ...run(wd, 'title-name', { methods: ['title-name'], permissive: true }),
    ...run(wd, 'title-name+country', { methods: ['title-name'], permissive: true, useCountry: true }),
    ...run(wd, 'description-name', { methods: ['description-name'], permissive: true }),
    ...run(gtd, 'named-place', { methods: ['named-place'], permissive: true }),
  ].filter(t => t.hit);
  writeFileSync(join(OUT, 'explore.json'), JSON.stringify(explore));
  console.log(`  done in ${Math.round((Date.now() - t0) / 1000)} s`);

  const triedOf = (key: string) => {
    const [set, method] = key.split('|');
    const m = method.split(' ')[0].replace(/^(cascade|no-article):.*/, '$1');
    return set === 'all' ? [...tried].filter(([k]) => k.endsWith(`|${m}`) && !k.startsWith('gtd|')).reduce((s, [, n]) => s + n, 0) : (tried.get(`${set}|${m}`) ?? 0);
  };
  const sections = [
    ['By method (all Wikidata sets; GTD separately)', summarise(trials, t => `${t.set === 'gtd' ? 'gtd' : 'all'}|${t.method}`, triedOf)],
    ['Cascade (all Wikidata sets)', summarise(trials.filter(t => t.method.includes(':')), t => `all|${t.method.split(':')[0]}`, triedOf)],
    ['By method and precision', summarise(trials, t => `${t.set === 'gtd' ? 'gtd' : 'all'}|${t.method} ${PREC_NAME[t.geoPrec ?? 0] ?? ''}`, triedOf)],
    ['Name methods by kind', summarise(trials.filter(t => /name|named/.test(t.method) && !t.method.includes(':')), t => `${t.set === 'gtd' ? 'gtd' : 'all'}|${t.method} ${t.kind}`, triedOf)],
    ['Name methods by evidence', summarise(trials.filter(t => /name|named/.test(t.method) && !t.method.includes(':')), t => `${t.set === 'gtd' ? 'gtd' : 'all'}|${t.method} ${(t.evidence ?? []).filter(e => e !== 'hint').sort().join('+') || 'name only'}`, triedOf)],
    ['Cascade by set', summarise(trials.filter(t => t.method.startsWith('cascade:') || t.method.startsWith('no-article:')), t => `${t.set}|${t.method}`, triedOf)],
  ] as const;
  const md = sections.map(([title, rows]) => `### ${title}\n\n${markdown([...rows], 'set|method')}`).join('\n\n');
  writeFileSync(join(OUT, 'benchmark.md'), `${md}\n`);
  writeFileSync(join(OUT, 'trials.json'), JSON.stringify(trials));
  console.log(md);
}

main();
