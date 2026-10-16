import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec, type EventEntityRow } from '@takip/db';
import { type Ctx, type Dataset, importDataset, REPO, sourceId } from '../context';
import { num, readCsv, text } from '../csv';
import { ymd } from '../dates';
import { anchor, EventBatch, resolveCanonical, validLonLat } from '../events';
import { Resolver } from '../resolver';
import { readWikiTable, wikiTablePath } from '../wiki';
import { AS_OF, DIR } from './cow';

const f = (name: string) => join(DIR, name);

const TERRITORIAL = f('territorial_changes_since_1816.csv');
/**
 * The territory each change moved, which the Kaggle file drops: number, entity and portion from COW Territorial
 * Change v6 (tc2018.csv, correlatesofwar.org) in the same row order, plus `fix` where COW's code is missing or wrong.
 */
export const TERRITORIAL_ROWS = join(REPO, 'tools/import/datasets/cow-territorial-rows.csv');
/** Where each territory lies: COW entity codes, and x: keys for territories COW has no code for. */
export const TERRITORIAL_PLACES = join(REPO, 'tools/import/datasets/cow-territorial-places.csv');

/**
 * COW territorial changes the WW2 borders dataset also dates, matched by hand on COW's change number. COW dates
 * a change by the year it was recognised, so its 1945–47 treaty rows don't match WW2's earlier occupations.
 * part_of: one WW2 row is a piece of a COW change.
 */
export const WW2_MATCHES: [cowNumber: string, ww2: string, rel: 'same_as' | 'part_of', confidence: number][] = [
  ['573', 'Austria:19380313', 'same_as', 1],
  ['574', 'Sudetenland:19380930', 'same_as', 1],
  ['575', 'Teschen (German):19381001', 'same_as', 1], // Trans-Olza to Poland
  ['576', 'Southern Slovakia:19381102', 'same_as', 1], // First Vienna Award
  ['577', 'Protectorate of Bohemia and Moravia:19390316', 'same_as', 0.8], // COW's area is twice the Protectorate's
  ['578', 'Memel:19390322', 'same_as', 1],
  ['579', 'Sub-Carpathian Ruthenia:19390404', 'same_as', 1],
  ['580', 'Slovakia:19390314', 'same_as', 1],
  ['582', 'Western Vilnius:19391028', 'same_as', 1],
  ['584', 'Southern Dobrudja:19400907', 'same_as', 1],
  ['585', 'Estonia:19400615', 'same_as', 1],
  ['586', 'Latvia:19400615', 'same_as', 1],
  ['587', 'Lithuania:19400615', 'same_as', 1],
  ['894', 'Karelia:19400312', 'part_of', 1], // Moscow Peace Treaty
  ['894', 'Gulf of Finland Islands:19400312', 'part_of', 1],
  ['894', 'Rybachi Peninsula:19400312', 'part_of', 1],
  ['894', 'Salla:19400312', 'part_of', 1],
];

/**
 * iso3c is the modern successor's code and names are COW's for the whole span ("Germany", "Russia", "Yugoslavia").
 * The polity's own COW code at `t` gives the state of the day: DEU in 1866 is Prussia, RUS in 1940 the USSR.
 */
function stateOfTheDay(ctx: Ctx, r: Resolver) {
  const codes = new Map<number, Set<string>>();
  const rows = ctx.catalog.prepare(`
    SELECT i.entity_id AS id, i.value FROM core_entity_identifier i JOIN core_id_scheme s USING (scheme_id) WHERE s.code = 'cow'
  `).all() as { id: number; value: string }[];
  for (const row of rows) {
    const set = codes.get(row.id) ?? new Set();
    set.add(row.value);
    codes.set(row.id, set);
  }
  return (id: number, t: number) => {
    for (const c of codes.get(id) ?? []) {
      const e = r.resolve('cow', c, t);
      if (e !== undefined) return e;
    }
    return id;
  };
}

export async function readTerritorialPlaces(path = TERRITORIAL_PLACES) {
  const places = new Map<string, { name: string; lon: number; lat: number }>();
  for (const p of await readCsv(path)) {
    const lon = Number(p.lon);
    const lat = Number(p.lat);
    if (places.has(p.key)) throw new Error(`cow-territorial-places.csv: ${p.key} twice`);
    if (!validLonLat(lon, lat)) throw new Error(`cow-territorial-places.csv: ${p.key} has no valid lon/lat`);
    places.set(p.key, { name: p.name, lon, lat });
  }
  return places;
}

export async function importCowTerritorial(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'cow-territorial',
      version: AS_OF,
      asOf: AS_OF,
      files: [TERRITORIAL, TERRITORIAL_ROWS, TERRITORIAL_PLACES, wikiTablePath('cow-territorial')],
      skipped: ['territorial_changes_since_1945.csv', 'conquests_since_1816.csv', 'conquests_since_1945.csv'].map(s => ({ file: f(s), duplicateOf: TERRITORIAL })),
      importerVersion: '4',
    },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;
      const ofTheDay = stateOfTheDay(ctx, r);
      const eras = new Map<string, number>();
      const names = new Map<number, string>();
      for (const e of ctx.catalog.prepare(`SELECT entity_id AS id, name FROM core_entity`).all() as { id: number; name: string }[]) names.set(e.id, e.name);

      const polity = (iso3: string, name: string | null, t: number) => {
        if (!name) {
          rep.sentinel('country NA → no polity (non-state)');
          return undefined;
        }
        const found = r.resolve('iso3', text(iso3), t) ?? r.byName(name, t, { politiesOnly: true });
        if (found === undefined) {
          rep.miss(text(iso3) ? `iso3:${iso3} ${name}` : `name:${name}`);
          return undefined;
        }
        const id = ofTheDay(found, t);
        if (id !== found) {
          const k = `${name} → ${names.get(id)}`;
          eras.set(k, (eras.get(k) ?? 0) + 1);
        }
        return id;
      };

      const rows = await readCsv(TERRITORIAL);
      const territories = await readCsv(TERRITORIAL_ROWS);
      const places = await readTerritorialPlaces();
      const wiki = await readWikiTable('cow-territorial');
      if (territories.length !== rows.length) throw new Error(`cow-territorial-rows.csv has ${territories.length} rows, the raw file ${rows.length}`);

      const batch = new EventBatch(ctx, ds);
      const seen = new Map<string, Set<string>>();
      for (const [i, row] of rows.entries()) {
        rep.rows++;
        const tc = territories[i];
        // Joined by position, so a reordered or edited raw file must fail rather than take another row's territory.
        if (tc.year !== row.year || tc.area !== row.area.trim()) {
          throw new Error(`cow-territorial-rows.csv row ${i + 1} (#${tc.number} ${tc.year} ${tc.area}) doesn't match ${row.year} ${row.area}`);
        }
        const year = num(row.year);
        const t = year === null ? null : ymd(year);
        if (!t) {
          rep.reject('bad year', JSON.stringify(row));
          continue;
        }
        const type = row.type.replace(/\s*\n\s*/g, ' ').trim();
        const gainName = text(row.country_gaining);
        const loseName = text(row.country_losing);
        if (!gainName && !loseName) {
          rep.reject('gaining and losing both NA (not drawable)', JSON.stringify(row));
          continue;
        }

        const hash = createHash('sha1').update([row.year, row.country_gaining, row.country_losing, type, row.area].join('\x1f')).digest('hex');
        const full = Object.values(row).join('\x1f');
        const same = seen.get(hash) ?? new Set();
        seen.set(hash, same);
        if (same.has(full)) {
          rep.reject('exact duplicate row', `${row.year} ${gainName} ← ${loseName}: ${type}`);
          continue;
        }
        const ordinal = same.size;
        same.add(full);

        const gaining = polity(row.iso3c_gaining, gainName, t.t);
        const losing = polity(row.iso3c_losing, loseName, t.t);
        const entities: EventEntityRow[] = [];
        if (gaining !== undefined) entities.push({ entityId: gaining, role: 'gaining' });
        if (losing !== undefined) entities.push({ entityId: losing, role: 'losing' });

        if (row.pop.trim() === '.') rep.sentinel('pop . → null');
        if (row.area.trim() === '.') rep.sentinel('area . → null');
        const word = type.split(' ')[0].toLowerCase();
        const process = word === 'mandated' ? 'mandate' : word;

        const key = tc.fix || tc.entity;
        const place = places.get(key);
        if (!place) rep.miss(`territory:#${tc.number} ${key}`);
        // Part of a unit (portion 0) is only located to that unit, so it stays country precision.
        const at = place
          ? { lon: place.lon, lat: place.lat, geoPrec: tc.portion === '1' || tc.fix ? GeoPrec.area : GeoPrec.country }
          : anchor(r, null, null, GeoPrec.country, [losing ?? gaining]);
        // Non-state sides (Kashmir, Transvaal) are the territory but show as "Non-state territory", so they keep the name.
        const shown = (key === tc.gainer && gainName) || (key === tc.loser && loseName);
        const named = place && !shown ? `${place.name}: ` : '';

        batch.add({
          kind: 'change.territorial',
          sourceRecordId: `${hash}:${ordinal}`,
          title: `${named}${loseName ?? 'Non-state territory'} → ${gainName ?? 'non-state entity'} (${process})`,
          tStart: t.t,
          tStartPrec: Prec.year,
          ...at,
          attrs: {
            process,
            type,
            pop: num(row.pop),
            area_km2: num(row.area),
            gaining: gainName,
            losing: loseName,
            territory: place?.name ?? null,
            cow_number: num(tc.number),
            cow_entity: place ? key : null,
            portion: num(tc.portion),
            wiki: (place && wiki.get(place.name)) ?? null,
          },
          entities,
        });
      }
      rep.extra.state_of_the_day = Object.fromEntries([...eras].sort((a, b) => b[1] - a[1]));
      const publish = batch.finish();
      linkWw2(ctx, ds);
      return publish;
    },
  );
}

/** same_as / part_of to the WW2 borders' changes; WW2 is canonical (day and region, not year and country). */
function linkWw2(ctx: Ctx, ds: Dataset) {
  const ww2 = sourceId(ctx, 'ww2-borders');
  if (ctx.events.eventId(ww2, WW2_MATCHES[0][1]) === undefined) {
    ds.report.extra.links = 'skipped: ww2-borders is not loaded; re-run cow-territorial after it';
    return;
  }
  const byNumber = ctx.history.prepare(`
    SELECT event_id FROM ev_event WHERE source_id = ? AND retracted_at IS NULL AND json_extract(attrs, '$.cow_number') = ?
  `).pluck();
  const n = { same_as: 0, part_of: 0 };
  ctx.history.transaction(() => {
    ctx.events.clearRelations(ds.sourceId);
    for (const [number, record, rel, confidence] of WW2_MATCHES) {
      const cow = byNumber.all(ds.sourceId, Number(number)) as number[];
      const other = ctx.events.eventId(ww2, record);
      if (cow.length !== 1 || other === undefined) {
        ds.report.miss(`link #${number} ↔ ${record}`);
        continue;
      }
      if (rel === 'part_of') ctx.events.relate(other, rel, cow[0], confidence, ds.sourceId);
      else ctx.events.relate(cow[0], rel, other, confidence, ds.sourceId);
      n[rel]++;
    }
  })();
  const canonical = resolveCanonical(ctx);
  ctx.events.rebuildTimeline([ctx.events.family('change.territorial')]);
  ds.report.extra.links = { ...n, canonical_updated: canonical };
}
