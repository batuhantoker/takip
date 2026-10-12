import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOREVER_LO } from '@takip/core/time';
import type { EventKindInput } from '@takip/db';
import { batched, type Ctx, REPO, sourceId } from '../context';
import { readCsv } from '../csv';
import { normName } from '../names';
import { KEY_SCHEME, Resolver } from '../resolver';

const here = (f: string) => join(REPO, 'tools/import/seed', f);

/** High ids so they never collide with the fixed ids catalog.db migrations hand out. */
const SCHEMES: [number, string][] = [
  [1000, KEY_SCHEME],
  [1001, 'native:gtd'],
  [1002, 'native:tradewar'],
  [1003, 'unesco'],
  [1004, 'glwd'],
];

/*
 * Licence terms are mostly unverified (DATA-SOURCES.md). Per the standing rule, every source is visible to every
 * tier while terms are pending; can_export stays 0. GTD is non-commercial and forbids redistribution; GLWD v1 is
 * free for non-commercial use; the Kaggle compilations (WAC, trade war, IQ) state no licence.
 */
const LICENCES = [
  { code: 'cc-by-4.0', name: 'Creative Commons Attribution 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', commercial: null, redistribution: 'attribution' },
  { code: 'cc-by-sa-4.0', name: 'Creative Commons Attribution-ShareAlike 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', commercial: null, redistribution: 'share_alike' },
  { code: 'cc-by-sa-3.0-igo', name: 'Creative Commons Attribution-ShareAlike 3.0 IGO', url: 'https://creativecommons.org/licenses/by-sa/3.0/igo/', commercial: null, redistribution: 'share_alike' },
  { code: 'cow-terms', name: 'Correlates of War: free use with citation', url: 'https://correlatesofwar.org/data-sets/', commercial: null, redistribution: 'attribution' },
  { code: 'gtd-terms', name: 'GTD terms of use: non-commercial, no redistribution', url: 'https://www.start.umd.edu/gtd/terms-of-use/', commercial: 0, redistribution: 'none' },
  { code: 'glwd-terms', name: 'GLWD: free for non-commercial use', url: 'https://www.worldwildlife.org/pages/global-lakes-and-wetlands-database', commercial: 0, redistribution: 'attribution' },
  // "Reuse and adaptation encouraged for scholarly work; commercial use strictly prohibited; inform the authors of changes."
  { code: 'stanford-shl-nc', name: 'Stanford Spatial History Lab: scholarly reuse, no commercial use', url: 'https://web.stanford.edu/group/spatialhistory/static/publications/pub51.html', commercial: 0, redistribution: 'attribution' },
  { code: 'unknown', name: 'No licence stated', url: null, commercial: null, redistribution: 'unknown' },
] as const;

type SourceSeed = { code: string; name: string; owner: string; url?: string; licence: string; events?: boolean; attribution?: string };

export const SOURCES: SourceSeed[] = [
  { code: 'naturalearth', name: 'Natural Earth admin-0', owner: 'Natural Earth', url: 'https://www.naturalearthdata.com/', licence: 'public-domain' },
  { code: 'takip-seed', name: 'TAKIP code crosswalk and aliases', owner: 'TAKIP', licence: 'public-domain' },
  { code: 'wac1914', name: 'Global Wars & Armed Conflicts, 1914–2026', owner: 'Kaggle compilation', licence: 'unknown', events: true },
  { code: 'cow-interstate', name: 'COW Inter-State War Data v4.0', owner: 'Correlates of War Project', url: 'https://correlatesofwar.org/data-sets/cow-war/', licence: 'cow-terms', events: true },
  { code: 'cow-extra', name: 'COW war list: rows added by the compiler', owner: 'Kaggle compilation', licence: 'unknown', events: true },
  { code: 'cow-territorial', name: 'COW Territorial Change v6', owner: 'Correlates of War Project', url: 'https://correlatesofwar.org/data-sets/territorial-change/', licence: 'cow-terms', events: true },
  { code: 'icow', name: 'ICOW Territorial Claims 1816–2001', owner: 'Issue Correlates of War', url: 'http://www.paulhensel.org/icowterr.html', licence: 'cow-terms', events: true },
  { code: 'ucdp-brd', name: 'UCDP Battle-Related Deaths', owner: 'Uppsala Conflict Data Program', url: 'https://ucdp.uu.se/downloads/', licence: 'cc-by-4.0', events: true },
  { code: 'gtd', name: 'Global Terrorism Database', owner: 'START, University of Maryland', url: 'https://www.start.umd.edu/gtd/', licence: 'gtd-terms', events: true },
  { code: 'ww1-wiki', name: 'World War I battles (Wikipedia)', owner: 'Wikipedia contributors', url: 'https://en.wikipedia.org/', licence: 'cc-by-sa-4.0', events: true },
  { code: 'tradewar', name: 'Global Trade War 2018–present', owner: 'Kaggle compilation', licence: 'unknown', events: true },
  { code: 'wdi', name: 'World Development Indicators', owner: 'World Bank', url: 'https://datacatalog.worldbank.org/', licence: 'cc-by-4.0' },
  { code: 'owid-conflict', name: 'OWID: deaths in ongoing conflicts', owner: 'Our World in Data', url: 'https://ourworldindata.org/war-and-peace', licence: 'cc-by-4.0' },
  { code: 'owid-le', name: 'OWID: life expectancy at different ages', owner: 'Our World in Data', url: 'https://ourworldindata.org/life-expectancy', licence: 'cc-by-4.0' },
  { code: 'owid-le-hmd', name: 'OWID: life expectancy (HMD + UN WPP)', owner: 'Our World in Data', url: 'https://ourworldindata.org/life-expectancy', licence: 'cc-by-4.0' },
  { code: 'owid-edu', name: 'OWID: global education', owner: 'Our World in Data', url: 'https://ourworldindata.org/global-education', licence: 'cc-by-4.0' },
  { code: 'owid-water', name: 'OWID: safely managed drinking water', owner: 'Our World in Data', url: 'https://ourworldindata.org/water-access', licence: 'cc-by-4.0' },
  { code: 'owid-mental', name: 'OWID: mental health', owner: 'Our World in Data', url: 'https://ourworldindata.org/mental-health', licence: 'cc-by-4.0' },
  { code: 'iq-2023', name: 'International IQ (2023 compilation)', owner: 'Kaggle compilation', licence: 'unknown' },
  { code: 'unesco-whc', name: 'UNESCO World Heritage List 2021', owner: 'UNESCO World Heritage Centre', url: 'https://whc.unesco.org/en/syndication', licence: 'cc-by-sa-3.0-igo' },
  { code: 'glwd', name: 'Global Lakes and Wetlands Database, level 1', owner: 'WWF / University of Kassel', url: 'https://www.worldwildlife.org/pages/global-lakes-and-wetlands-database', licence: 'glwd-terms' },
  { code: 'ww2-borders', name: 'European Borders, World War II (1938–1945)', owner: 'Stanford Spatial History Lab (M. De Groot)', url: 'https://web.stanford.edu/group/spatialhistory/static/publications/pub51.html', licence: 'stanford-shl-nc', events: true },
];

const TIERS = ['anon', 'free', 'paid', 'internal'] as const;

/** Event kinds for every source in the design, so live and imported writers agree on codes and families. */
export const KINDS: EventKindInput[] = [
  { code: 'war', family: 'conflict' },
  { code: 'war.interstate', family: 'conflict', parent: 'war' },
  { code: 'war.civil', family: 'conflict', parent: 'war' },
  { code: 'war.world', family: 'conflict', parent: 'war' },
  { code: 'war.independence', family: 'conflict', parent: 'war' },
  { code: 'conflict.armed', family: 'conflict' },
  { code: 'battle', family: 'conflict' },
  { code: 'attack.terror', family: 'terror' },
  { code: 'claim.territorial', family: 'territorial' },
  { code: 'change.territorial', family: 'territorial' },
  { code: 'econ.tariff', family: 'econ' },
  { code: 'status.in_danger', family: 'heritage' },
  { code: 'hazard.quake', family: 'hazard' },
  { code: 'hazard.fire', family: 'hazard' },
  { code: 'alert.weather', family: 'alert' },
  { code: 'outage.internet', family: 'cyber' },
  { code: 'cyber.c2', family: 'cyber' },
  { code: 'news.report', family: 'news' },
  { code: 'gdelt.event', family: 'news' },
];

export const ROLES = [
  'participant', 'side_a', 'side_b', 'supporter', 'initiator', 'location', 'perpetrator', 'target', 'target_nationality',
  'gaining', 'losing', 'imposing', 'targeted', 'claimant', 'subject',
];

const DEPENDENCIES = new Set(
  'MNP VIR GUM ASM PRI SGS IOT SHN PCN AIA FLK CYM BMU VGB TCA MSR JEY GGY IMN NIU COK ABW CUW SPM WLF MAF BLM PYF NCL ATF ALD GRL FRO MAC HKG HMD NFK SXM IOA ATC'.split(' '),
);
const DISPUTED = new Set('SOL CYN SAH KOS PSX KAS ATA'.split(' '));
/** Shapes that carry another polity's codes in countries.json. */
const NO_CODES = new Set(['IOA', 'ATC']);

const date = (s: string) => (s ? Date.parse(`${s}T00:00:00Z`) : null);

type Feature = { properties: { id: string; name: string; iso2?: string; iso3?: string; label: [number, number] } };

export async function seed(ctx: Ctx) {
  const db = ctx.catalog;
  db.prepare(`UPDATE core_id_scheme SET code = ? WHERE scheme_id = 1000 AND code = 'osiris'`).run(KEY_SCHEME);
  db.prepare(`UPDATE meta_source SET code = 'takip-seed' WHERE code = 'osiris-seed'`).run();
  const ins = db.prepare(`INSERT OR IGNORE INTO core_id_scheme (scheme_id, code) VALUES (?, ?)`);
  for (const [id, code] of SCHEMES) ins.run(id, code);

  db.transaction(() => {
    const lic = db.prepare(`
      INSERT INTO meta_licence (code, name, url, commercial_use, redistribution) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (code) DO UPDATE SET name = excluded.name, url = excluded.url, commercial_use = excluded.commercial_use,
        redistribution = excluded.redistribution
    `);
    for (const l of LICENCES) lic.run(l.code, l.name, l.url, l.commercial, l.redistribution);
    const src = db.prepare(`
      INSERT INTO meta_source (code, name, owner, url, licence_id, delivery, event_table)
      VALUES (?, ?, ?, ?, (SELECT licence_id FROM meta_licence WHERE code = ?), 'bulk', ?)
      ON CONFLICT (code) DO UPDATE SET name = excluded.name, owner = excluded.owner, url = excluded.url,
        licence_id = excluded.licence_id, event_table = excluded.event_table
    `);
    for (const s of SOURCES) src.run(s.code, s.name, s.owner, s.url ?? null, s.licence, s.events ? 'event' : null);
    const policy = db.prepare(`
      INSERT OR IGNORE INTO meta_access_policy (tier, licence_id, can_view, can_export)
      SELECT ?, licence_id, 1, 0 FROM meta_licence WHERE code = ?
    `);
    for (const l of LICENCES) for (const t of TIERS) policy.run(t, l.code);
  })();

  ctx.events.ensureKinds(KINDS);
  ctx.events.ensureRoles(ROLES);

  const ne = sourceId(ctx, 'naturalearth');
  const seedSrc = sourceId(ctx, 'takip-seed');
  const r = new Resolver(ctx);
  const polityType = r.typeId('polity');
  const keyScheme = r.schemeId(KEY_SCHEME);
  const now = Date.now();

  const newEntity = db.prepare(`INSERT INTO core_entity (type_id, name, lon, lat, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING entity_id`).pluck();
  const updEntity = db.prepare(`UPDATE core_entity SET name = ?, lon = ?, lat = ?, updated_at = ? WHERE entity_id = ? AND (name IS NOT ? OR lon IS NOT ? OR lat IS NOT ?)`);
  const polity = db.prepare(`
    INSERT INTO core_polity (entity_id, kind, valid_lo, valid_hi) VALUES (?, ?, ?, ?)
    ON CONFLICT (entity_id) DO UPDATE SET kind = excluded.kind, valid_lo = excluded.valid_lo, valid_hi = excluded.valid_hi
  `);
  const ident = db.prepare(`
    INSERT INTO core_entity_identifier (scheme_id, value, valid_lo, valid_hi, entity_id, source_id) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (scheme_id, value, valid_lo) DO UPDATE SET valid_hi = excluded.valid_hi, entity_id = excluded.entity_id, source_id = excluded.source_id
  `);
  const hasName = db.prepare(`SELECT 1 FROM core_entity_name WHERE entity_id = ? AND norm = ? AND valid_lo = ? AND valid_hi IS ?`).pluck();
  const name = db.prepare(`INSERT INTO core_entity_name (entity_id, name, norm, kind, valid_lo, valid_hi, source_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const addName = (entityId: number, n: string, kind: string, lo: number, hi: number | null, src: number) => {
    if (!hasName.get(entityId, normName(n), lo, hi)) name.run(entityId, n, normName(n), kind, lo, hi, src);
  };

  const keys = new Map<string, number>();
  const upsertPolity = (key: string, n: string, lon: number, lat: number, kind: string, lo: number, hi: number | null, src: number) => {
    let id = r.key(key);
    if (id === undefined) {
      id = newEntity.get(polityType, n, lon, lat, now) as number;
      ident.run(keyScheme, key, FOREVER_LO, null, id, src);
    } else updEntity.run(n, lon, lat, now, id, n, lon, lat);
    polity.run(id, kind, lo, hi);
    addName(id, n, 'official', lo, hi, src);
    keys.set(key, id);
    return id;
  };

  const features = (JSON.parse(readFileSync(join(REPO, 'public/data/boundaries/countries.json'), 'utf8')) as { features: Feature[] }).features;
  batched(db, features, f => {
    const p = f.properties;
    const kind = DISPUTED.has(p.id) ? 'disputed' : DEPENDENCIES.has(p.id) ? 'dependency' : 'sovereign';
    const id = upsertPolity(p.id, p.name, p.label[0], p.label[1], kind, FOREVER_LO, null, ne);
    if (NO_CODES.has(p.id)) return;
    if (p.iso3) ident.run(r.schemeId('iso3'), p.iso3, FOREVER_LO, null, id, ne);
    if (p.iso2) ident.run(r.schemeId('iso2'), p.iso2, FOREVER_LO, null, id, ne);
  });

  const extra = await readCsv(here('polities.csv'));
  const render = db.prepare(`INSERT OR IGNORE INTO core_polity_render (polity_id, render_polity_id, valid_lo, valid_hi) VALUES (?, ?, ?, ?)`);
  const successor = db.prepare(`
    INSERT OR IGNORE INTO core_entity_link (from_id, rel_id, to_id, valid_lo, source_id)
    SELECT ?, rel_id, ?, ?, ? FROM core_link_rel WHERE code = 'successor_of'
  `);
  batched(db, extra, p => {
    const lo = date(p.from) ?? FOREVER_LO;
    const hi = date(p.to);
    const id = upsertPolity(p.key, p.name, Number(p.lon), Number(p.lat), p.kind, lo, hi, seedSrc);
    if (/^[A-Z]{3}$/.test(p.key)) ident.run(r.schemeId('iso3'), p.key, FOREVER_LO, null, id, seedSrc);
    for (const target of p.render ? p.render.split('|') : []) {
      const to = keys.get(target);
      if (to === undefined) throw new Error(`polities.csv: ${p.key} renders as unknown ${target}`);
      render.run(id, to, lo, hi);
      if (p.kind === 'historical' && hi !== null) successor.run(to, id, hi, seedSrc);
    }
  });

  const ids = await readCsv(here('identifiers.csv'));
  batched(db, ids, i => {
    const id = keys.get(i.key);
    if (id === undefined) throw new Error(`identifiers.csv: unknown key ${i.key} for ${i.scheme}:${i.value}`);
    ident.run(r.schemeId(i.scheme), i.value, date(i.from) ?? FOREVER_LO, date(i.to), id, seedSrc);
  });

  const aliases = await readCsv(here('aliases.csv'));
  batched(db, aliases, a => {
    const id = keys.get(a.key);
    if (id === undefined) throw new Error(`aliases.csv: unknown key ${a.key} for ${a.name}`);
    addName(id, a.name, 'alias', date(a.from) ?? FOREVER_LO, date(a.to), seedSrc);
  });

  r.reload();
  const world = r.region('world', 'World', seedSrc);
  const eu27 = r.region('eu27', 'European Union (27)', seedSrc);
  const international = r.region('international', 'International', seedSrc);
  const cis = r.region('cis', 'Commonwealth of Independent States', seedSrc);
  // Anchors for events whose only party is a group (tariffs on "EU" or "ALL").
  db.prepare(`UPDATE core_entity SET lon = ?, lat = ? WHERE entity_id = ? AND lon IS NULL`).run(4.35, 50.85, eu27);
  db.transaction(() => {
    for (const n of ['Global', 'ALL', 'World (WB)']) addName(world, n, 'alias', FOREVER_LO, null, seedSrc);
    for (const n of ['EU', 'EU27', 'EU (27)', 'European Union']) addName(eu27, n, 'alias', FOREVER_LO, null, seedSrc);
    addName(international, 'Multinational', 'alias', FOREVER_LO, null, seedSrc);
    addName(cis, 'CIS', 'alias', FOREVER_LO, null, seedSrc);
    ident.run(r.schemeId('owid'), 'OWID_WRL', FOREVER_LO, null, world, seedSrc);
    ident.run(r.schemeId('wb'), 'WLD', FOREVER_LO, null, world, seedSrc);
    ident.run(r.schemeId('wb'), 'EUU', FOREVER_LO, null, eu27, seedSrc);
  })();

  const overlaps = checkOverlaps(ctx);
  if (overlaps.length) throw new Error(`overlapping identifier validity:\n${overlaps.join('\n')}`);
  ctx.log(`seed: ${features.length} admin-0 polities, ${extra.length} extra, ${ids.length} identifiers, ${aliases.length} aliases`);
}

/** Schemes the importers write; the worker's (mmsi, icao24, norad, …) are its own to check. */
const IMPORT_SCHEMES = [KEY_SCHEME, 'iso3', 'iso2', 'isonum', 'wb', 'cow', 'gw', 'gtd', 'owid', 'ucdp_actor', 'wac', 'ticker', 'iso4217', ...SCHEMES.map(([, c]) => c)];

/** db:check's identifier rule (§6): no two validity periods of one (scheme, value) may overlap. */
export function checkOverlaps(ctx: Ctx) {
  return (ctx.catalog.prepare(`
    SELECT s.code || ':' || a.value || ' ' || a.valid_lo || '..' || coalesce(a.valid_hi, '') || ' vs ' || b.valid_lo AS msg
    FROM core_entity_identifier a JOIN core_entity_identifier b ON a.scheme_id = b.scheme_id AND a.value = b.value AND a.valid_lo < b.valid_lo
    JOIN core_id_scheme s ON s.scheme_id = a.scheme_id
    WHERE coalesce(a.valid_hi, 8640000000000000) > b.valid_lo AND s.code IN (SELECT value FROM json_each(?))
  `).pluck().all(JSON.stringify([...new Set(IMPORT_SCHEMES)])) as string[]);
}

