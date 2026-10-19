import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { fromWkt, GeoLayerWriter, GeoPrec, type Geometry, type GeoLayerSpec } from '@takip/db';
import { type Ctx, type Dataset, importDataset, RAW, REPO } from '../context';
import { csvRecords, num, text } from '../csv';
import { utc } from '../dates';
import { EventBatch } from '../events';
import { Resolver } from '../resolver';
import { articleFiles, Articles } from '../articles';

const COUNTRIES = join(REPO, 'public/data/boundaries/countries.json');
const UNESCO = join(RAW, 'UNESCO Heritage siteswhc-sites(tangibles)-2021.csv');
const GLWD = join(RAW, 'Global Lakes and Wetlands Database.csv');

export async function buildLayer(ctx: Ctx, ds: Dataset, spec: Omit<GeoLayerSpec, 'sourceId'>, fill: (w: GeoLayerWriter) => Promise<void>) {
  const w = GeoLayerWriter.open(ctx.layout, ctx.catalog, { ...spec, sourceId: ds.sourceId });
  try {
    await fill(w);
  } catch (e) {
    w.abort();
    throw e;
  }
  const out = w.publish();
  ds.report.extra.layer = { code: out.code, version: out.version, features: out.features, pieces: out.pieces, bytes: out.bytes };
  return out;
}

function linker(ctx: Ctx, r: Resolver, sourceId: number) {
  const rel = ctx.catalog.prepare(`SELECT rel_id FROM core_link_rel WHERE code = 'located_in'`).pluck().get() as number;
  const ins = ctx.catalog.prepare(`INSERT OR IGNORE INTO core_entity_link (from_id, rel_id, to_id, source_id) VALUES (?, ?, ?, ?)`);
  const clear = ctx.catalog.prepare(`DELETE FROM core_entity_link WHERE from_id = ? AND rel_id = ? AND source_id = ?`);
  return (from: number, to: number[]) => {
    clear.run(from, rel, sourceId);
    for (const t of new Set(to)) ins.run(from, rel, t, sourceId);
  };
}

function refresh(ctx: Ctx, entityId: number, name: string, lon: number, lat: number, attrs: Record<string, unknown>) {
  ctx.catalog.prepare(`UPDATE core_entity SET name = ?, lon = ?, lat = ?, attrs = ?, updated_at = ? WHERE entity_id = ?`)
    .run(name, lon, lat, JSON.stringify(attrs), Date.now(), entityId);
}

/** Natural Earth admin-0 from the app's boundaries file; the choropleth layer series are drawn on (§8.6). */
export async function importAdmin0(ctx: Ctx) {
  await importDataset(ctx, { source: 'naturalearth', version: 'countries.json', asOf: '2026-10-12', files: [COUNTRIES], importerVersion: '1' }, async ds => {
    const r = new Resolver(ctx);
    type F = { properties: { id: string; name: string; iso2?: string; iso3?: string }; geometry: Geometry };
    const features = (JSON.parse(readFileSync(COUNTRIES, 'utf8')) as { features: F[] }).features;
    await buildLayer(ctx, ds, { code: 'admin0', geomKind: 'polygon', timeMode: 'static', tileProps: ['id', 'name'], keepSmall: true, maxzoom: 10 }, async w => {
      for (const f of features) {
        ds.report.rows++;
        const entityId = r.key(f.properties.id);
        if (entityId === undefined) ds.report.miss(`admin0:${f.properties.id}`);
        const { id, name, iso2, iso3 } = f.properties;
        w.add({ entityId, sourceRecordId: id, props: { id, name, iso2: iso2 ?? null, iso3: iso3 ?? null }, geom: f.geometry });
      }
    });
    return {};
  });
}

const stripHtml = (s: string | null) =>
  s?.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim() || null;

/**
 * UNESCO World Heritage 2021: sites are points valid from inscription. The file has no listing dates for the
 * danger list: danger=1 means "in danger at as_of", and date_end alone is the year a site left the list.
 */
export async function importUnesco(ctx: Ctx) {
  const AS_OF = 2021;
  await importDataset(ctx, { source: 'unesco-whc', version: String(AS_OF), asOf: `${AS_OF}-07-31`, files: [UNESCO, ...articleFiles()], importerVersion: '3' }, async ds => {
    const r = new Resolver(ctx);
    const articles = Articles.read();
    const link = linker(ctx, r, ds.sourceId);
    const events = new EventBatch(ctx, ds);
    const seen = new Map<string, number>();
    await buildLayer(ctx, ds, { code: 'unesco-whc', geomKind: 'point', timeMode: 'valid', tileProps: ['name', 'category', 'danger'], minzoom: 2 }, async w => {
      for await (const s of csvRecords(UNESCO)) {
        ds.report.rows++;
        const name = text(s.Name);
        const lon = num(s.longitude);
        const lat = num(s.latitude);
        const year = num(s.date_inscribed);
        if (!name || lon === null || lat === null || year === null) {
          ds.report.reject('missing name, point or inscription year', s.Name);
          continue;
        }
        const ordinal = (seen.get(name) ?? 0) + 1;
        seen.set(name, ordinal);
        const key = ordinal === 1 ? name : `${name} #${ordinal}`;
        const isoCodes = (s.iso_code ?? '').split(',').map(c => c.trim().toUpperCase()).filter(c => c && c !== '0');
        const names = (s['Country name'] ?? '').split(',').map(c => c.trim());
        const t = utc(year);
        const countries = isoCodes.map(c => r.resolve('iso2', c, t)).filter((id): id is number => id !== undefined);
        if (!countries.length) for (const n of names) {
          const id = r.byName(n, t, { politiesOnly: true });
          if (id !== undefined) countries.push(id);
          else ds.report.miss(`unesco country: ${n}`);
        }
        const attrs = {
          category: text(s.category_long),
          region: text(s.Region),
          area_ha: num(s.area_hectares),
          transboundary: s.transboundary === '1',
          revision: text(s.rev_bis),
          description: stripHtml(text(s.short_description)),
        };
        const entityId = r.ensure('heritage_site', 'unesco', key, name, ds.sourceId, { lon, lat });
        refresh(ctx, entityId, name, lon, lat, attrs);
        link(entityId, countries);
        const danger = s.danger === '1';
        w.add({
          entityId,
          sourceRecordId: key,
          validLo: t,
          tPrec: Prec.year,
          props: { name, category: text(s.category_short), danger, countries: isoCodes },
          geom: { type: 'Point', coordinates: [lon, lat] },
        });
        const end = num(s.date_end);
        if (danger || end !== null) {
          events.add({
            kind: 'status.in_danger',
            sourceRecordId: key,
            title: `${name}: ${danger ? 'in danger' : 'removed from the danger list'}`,
            tStart: utc(danger ? AS_OF : end!),
            tStartPrec: Prec.year,
            ongoing: danger,
            lon,
            lat,
            geoPrec: GeoPrec.exact,
            attrs: {
              phase: danger ? 'listed' : 'removed',
              t_raw: { danger: s.danger, date_end: s.date_end || null },
              wiki: articles?.heritageAt({ lon, lat }, name) ?? null,
            },
            entities: [{ entityId, role: 'subject' }, ...countries.map(c => ({ entityId: c, role: 'location' }))],
          });
        }
      }
    });
    return events.finish();
  });
}

const tierByArea = (km2: number | null) => (km2 === null ? 3 : km2 >= 10_000 ? 0 : km2 >= 1_000 ? 1 : km2 >= 200 ? 2 : 3);

/** GLWD level 1 lakes and reservoirs; reservoirs appear from the year they were dammed. */
export async function importGlwd(ctx: Ctx) {
  await importDataset(ctx, { source: 'glwd', version: '1', asOf: '2004-01-01', files: [GLWD], importerVersion: '1' }, async ds => {
    const r = new Resolver(ctx);
    const link = linker(ctx, r, ds.sourceId);
    await buildLayer(ctx, ds, { code: 'glwd-lakes', geomKind: 'polygon', timeMode: 'valid', tileProps: ['name', 'type', 'area_skm'], minzoom: 2 }, async w => {
      for await (const l of csvRecords(GLWD)) {
        ds.report.rows++;
        let geom: Geometry;
        try {
          geom = fromWkt(l.the_geom);
        } catch (e) {
          ds.report.reject('bad WKT', l.GLWD_ID);
          continue;
        }
        const dam = num(l.DAM_YEAR);
        const reservoir = l.TYPE === 'Reservoir';
        if (reservoir && (dam === null || dam <= 0)) ds.report.sentinel('reservoir DAM_YEAR 0/blank → static');
        const dated = reservoir && dam !== null && dam > 0;
        const at = dated ? utc(dam!) : utc(1990);
        const countryNames = [l.COUNTRY, l.SEC_CNTRY]
          .flatMap(c => (c ?? '').replace(/^\+\d+:\s*/, '').split(','))
          .map(c => c.trim())
          .filter(Boolean);
        const countries: number[] = [];
        for (const n of countryNames) {
          const id = r.byName(n, at, { politiesOnly: true });
          if (id !== undefined) countries.push(id);
          else ds.report.miss(`glwd country: ${n}`);
        }
        const name = text(l.LAKE_NAME) ?? text(l.DAM_NAME) ?? `${reservoir ? 'Reservoir' : 'Lake'} ${l.GLWD_ID}`;
        const area = num(l.AREA_SKM);
        const attrs = {
          type: l.TYPE,
          area_skm: area,
          volume_ckm: num(l.VOLUME_CKM),
          elevation_m: num(l.ELEV_M),
          dam_name: text(l.DAM_NAME),
          dam_year: dated ? dam : null,
          dam_height_m: num(l.DAM_HEIGHT),
          river: text(l.RIVER),
          near_city: text(l.NEAR_CITY),
          uses: [l.USE_1, l.USE_2, l.USE_3].map(text).filter(Boolean),
        };
        const lon = num(l.LONG_DEG);
        const lat = num(l.LAT_DEG);
        const entityId = r.ensure('waterbody', 'glwd', l.GLWD_ID, name, ds.sourceId, lon !== null && lat !== null ? { lon, lat } : undefined);
        if (lon !== null && lat !== null) refresh(ctx, entityId, name, lon, lat, attrs);
        link(entityId, countries);
        w.add({
          entityId,
          sourceRecordId: l.GLWD_ID,
          validLo: dated ? utc(dam!) : undefined,
          tPrec: dated ? Prec.year : 0,
          tier: tierByArea(area),
          props: { id: Number(l.GLWD_ID), name, type: l.TYPE, area_skm: area, dam_year: dated ? dam : null },
          geom,
        });
      }
    });
    return {};
  });
}
