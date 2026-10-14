import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoLayerWriter, type Geometry } from '@takip/db';
import { type Ctx, importDataset } from '../context';
import { utc } from '../dates';
import { CLIOPATRIA_DIR, CLIOPATRIA_VERSION } from '../fetch';
import { area, labelPoint } from './ww2';

/*
 * Cliopatria (Seshat Global History Databank): the world's polities year by year, 3400 BCE to 2024, drawn for world
 * scale. A row holds from FromYear to ToYear inclusive, in the clock's count (it has a year 0). The 2024 shapes stay
 * open. CC BY 4.0.
 */

export const DIR = CLIOPATRIA_DIR;
const AS_OF = '2026-10-03';
export const LAST_YEAR = 2024;

type Props = { name: string; subject: string | null; wiki: string | null; wikidata: string | null };
type SourceFeature = { properties: Record<string, unknown> | null; geometry: { type: string; coordinates: unknown } | null };
export type Row = { from: number; to: number; props: Props; geom: Geometry };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** "(Holy Roman Empire);(Kingdom of Bohemia)" → "Holy Roman Empire": the first is the widest whole. */
export function memberOf(v: unknown): string | null {
  return text(text(v)?.split(';')[0]?.replace(/^\(|\)$/g, ''));
}

/** An English title, or now and then another wiki's page without its scheme ("id.wikipedia.org/wiki/…"). */
export function wikiUrl(title: string | null) {
  if (!title) return null;
  if (/^[a-z-]+\.wikipedia\.org\/wiki\//.test(title)) return `https://${title}`;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function readRows(features: SourceFeature[], reject: (reason: string, sample: string) => void): Row[] {
  const rows: Row[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const name = text(p.Name);
    const from = Number(p.FromYear);
    const to = Number(p.ToYear);
    if (!name || !Number.isInteger(from) || !Number.isInteger(to) || to < from) {
      reject('no name or years', String(name));
      continue;
    }
    // "(British Empire)" and "(Alliance between …)" are drawn over their members; members name them in MemberOf.
    if (name.startsWith('(')) {
      reject('a union of polities drawn over its members', name);
      continue;
    }
    const g = f.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) {
      reject('not a polygon', `${name}:${g?.type ?? 'none'}`);
      continue;
    }
    rows.push({
      from,
      to,
      props: { name, subject: memberOf(p.MemberOf), wiki: wikiUrl(text(p.Wikipedia)), wikidata: text(p.Wikidata) },
      geom: g as Geometry,
    });
  }
  return rows;
}

/** A polity's consecutive rows with the same shape and attributes become one feature. */
export function mergeRows(rows: Row[]): Row[] {
  const sorted = [...rows].sort((a, b) => (a.props.name < b.props.name ? -1 : a.props.name > b.props.name ? 1 : a.from - b.from));
  const out: (Row & { key: string; hash: string })[] = [];
  for (const r of sorted) {
    const key = JSON.stringify(r.props);
    const hash = createHash('sha1').update(JSON.stringify(r.geom.coordinates)).digest('hex');
    const prev = out.at(-1);
    if (prev && prev.key === key && prev.hash === hash && prev.to + 1 === r.from) prev.to = r.to;
    else out.push({ ...r, key, hash });
  }
  return out.map(({ from, to, props, geom }) => ({ from, to, props, geom }));
}

export async function importCliopatria(ctx: Ctx) {
  const file = readdirSync(DIR, { withFileTypes: true }).find(f => f.isFile() && f.name.endsWith('.geojson'))?.name;
  if (!file) throw new Error(`cliopatria: no GeoJSON in ${DIR}; run \`npx tsx tools/import/fetch.ts cliopatria\``);
  const path = join(DIR, file);

  await importDataset(ctx, { source: 'cliopatria', version: CLIOPATRIA_VERSION, asOf: AS_OF, files: [path], importerVersion: '1' }, async ds => {
    const w = GeoLayerWriter.open(ctx.layout, ctx.catalog, {
      code: 'world-borders', sourceId: ds.sourceId, geomKind: 'polygon', timeMode: 'valid', minzoom: 0, maxzoom: 8,
      tileProps: ['name', 'subject', 'wiki', 'wikidata', 'area'], keepSmall: true,
    });
    let first = Infinity;
    try {
      const features = (JSON.parse(readFileSync(path, 'utf8')) as { features: SourceFeature[] }).features;
      ds.report.rows += features.length;
      for (const r of mergeRows(readRows(features, (reason, sample) => ds.report.reject(reason, sample)))) {
        first = Math.min(first, r.from);
        w.add({
          sourceRecordId: `${r.props.name}@${r.from}`,
          validLo: utc(r.from),
          validHi: r.to >= LAST_YEAR ? null : utc(r.to + 1),
          tPrec: Prec.year,
          props: { ...r.props, area: Math.round(area(r.geom) * 10) / 10, label: labelPoint(r.geom) },
          geom: r.geom,
        });
      }
      const out = w.publish();
      ds.report.extra.layer = { code: out.code, version: out.version, features: out.features, pieces: out.pieces, bytes: out.bytes };
    } catch (e) {
      w.abort();
      throw e;
    }
    return { tLo: utc(first), tHi: utc(LAST_YEAR + 1) };
  });
}
