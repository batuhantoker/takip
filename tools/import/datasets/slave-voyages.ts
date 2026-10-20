import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type EventInput, GeoPrec, type Position, toWkb } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { csvRecords, num } from '../csv';
import { ymd } from '../dates';
import { EventBatch } from '../events';
import { SV_FILES } from '../fetch-geocoded';
import { type GeoIndex, openGeoIndex } from '../geo/geo-index';
import { unwrap } from './ibtracs';
import { locate, lookup, nature, placeTable, type SvNode, type SvPlace, type TreeNode } from './slave-voyages-places';

const DIR = join(RAW_MORE, 'slave-voyages');
const PLACES = join(DIR, SV_FILES.places);
const LABELS = join(DIR, SV_FILES.labels);
const AS_OF = '2026-10-20';

export type Labels = Record<string, { value: number; name: string }[]>;
type Row = Record<string, string>;
export type VoyageEvent = Omit<EventInput, 'sourceId' | 'datasetId'>;

const DATABASES = {
  tast: { source: 'slave-voyages', file: SV_FILES.tast, version: '2019', name: 'Trans-Atlantic' },
  iam: { source: 'slave-voyages-intra', file: SV_FILES.iam, version: '1.0', name: 'Intra-American' },
} as const;

const str = (v: string | undefined) => v?.trim() || null;
const code = (v: string | undefined) => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};
/** Titles name a place by its first part: "Whydah, Ouidah" is Whydah, "Bahia, place unspecified" Bahia. */
const short = (name: string) => name.split(',')[0].trim();

/** The voyage's start: the recorded departure date, else SlaveVoyages' imputed year it began, else (Intra-American) the year it arrived. */
export function voyageStart(r: Row): { t: number; prec: Prec; from?: string } | null {
  const recorded = ymd(num(r.datedepc), num(r.datedepb), num(r.datedepa));
  if (recorded) return recorded;
  const began = ymd(num(r.yeardep));
  if (began) return { ...began, from: 'year the voyage began, imputed by SlaveVoyages' };
  const arrived = ymd(num(r.yearam));
  return arrived ? { ...arrived, from: 'year of arrival, imputed by SlaveVoyages (no departure date recorded)' } : null;
}

/** The port sequence: where captives were bought, a last port of call, where they were landed. Places known only by continent are left out. */
export function routeOf(r: Row, at: (c: number | null) => SvPlace | null): Position[] {
  const codes = (cols: string[]) => cols.map(c => code(r[c])).filter((c): c is number => c !== null);
  const bought = codes(['plac1tra', 'plac2tra', 'plac3tra']);
  const landed = codes(['sla1port', 'adpsale1', 'adpsale2']);
  const seq = [...(bought.length ? bought : codes(['mjbyptimp'])), ...codes(['npafttra']), ...(landed.length ? landed : codes(['mjslptimp']))];
  const pts: Position[] = [];
  for (const c of seq) {
    const p = at(c);
    if (!p || p.geoPrec === GeoPrec.country) continue;
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p.lon || last[1] !== p.lat) pts.push([p.lon, p.lat]);
  }
  const lons = unwrap(pts.map(p => p[0]));
  return pts.map((p, i) => [Math.round(lons[i] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]);
}

const ROLE = 'principal place of purchase';

/** One voyage as an event at its principal place of purchase, or the reason it has none. */
export function voyageEvent(r: Row, db: keyof typeof DATABASES, ctx: { node: (c: number | null) => SvNode | undefined; at: (c: number | null, role?: string) => SvPlace | null; label: (list: string, v: string | undefined) => string | null }): VoyageEvent | { reject: string } {
  const start = voyageStart(r);
  if (!start) return { reject: 'no date' };
  const buy = ['mjbyptimp', 'majbuypt', 'plac1tra'].map(c => code(r[c])).find(c => c !== null) ?? null;
  if (buy === null) return { reject: 'no place of purchase recorded' };
  const anchor = ctx.at(buy, ROLE);
  if (!anchor) {
    const n = ctx.node(buy);
    return { reject: !n ? 'place of purchase code not in SlaveVoyages’ tables' : nature(n) === 'nowhere' ? 'place of purchase not a place (at sea, a prize, unknown)' : 'place of purchase has no coordinates in SlaveVoyages’ tables' };
  }
  const landCode = ['mjslptimp', 'majselpt', 'sla1port'].map(c => code(r[c])).find(c => c !== null) ?? null;
  const name = (c: number | null) => (c === null ? null : (ctx.node(c)?.name ?? null));
  const landed = name(landCode);
  const ship = str(r.shipname);
  const route = routeOf(r, c => ctx.at(c));
  const crosses = route.some(([lon]) => lon < -180 || lon > 180);
  // The box must hold the dot too: a continent-only anchor isn't on the route.
  const extent: Position[] = [...route, [anchor.lon, anchor.lat]];
  const arrived = ymd(num(r.datarr34), num(r.datarr33), num(r.datarr32));
  const flag = ctx.label('NationalityList', r.national) ?? (ctx.label('NationalityList', r.natinimp) ? `${ctx.label('NationalityList', r.natinimp)} (imputed)` : null);
  const captor = ctx.label('VesselCapturedOutcomeList', r.fate3);
  const routeNames = [name(buy), name(code(r.npafttra)), landed].filter((x): x is string => !!x);
  return {
    kind: 'slavery.voyage',
    sourceRecordId: `${db}:${r.voyageid.trim()}`,
    title: `Slave voyage — ${ship ?? 'ship name not recorded'}, ${short(anchor.name)}${landed ? ` to ${short(landed)}` : ''}`,
    tStart: start.t,
    tStartPrec: start.prec,
    tEnd: arrived && arrived.t >= start.t ? arrived.t : null,
    tEndPrec: arrived && arrived.t >= start.t ? arrived.prec : null,
    lon: anchor.lon,
    lat: anchor.lat,
    geoPrec: anchor.geoPrec,
    bbox: route.length > 1 && !crosses ? { w: Math.min(...extent.map(p => p[0])), s: Math.min(...extent.map(p => p[1])), e: Math.max(...extent.map(p => p[0])), n: Math.max(...extent.map(p => p[1])) } : null,
    geom: route.length > 1 ? toWkb({ type: 'LineString', coordinates: route }) : null,
    magnitude: num(r.slaximp),
    ...(anchor.confidence !== undefined && { confidence: anchor.confidence }),
    attrs: {
      flag,
      captain: [r.captaina, r.captainb, r.captainc].map(str).filter(Boolean).join('; ') || null,
      disembarked: num(r.slamimp),
      died_on_voyage: num(r.vymrtimp),
      outcome: ctx.label('ParticularOutcomeList', r.fate),
      outcome_for_captives: ctx.label('SlavesOutcomeList', r.fate2),
      ship,
      embarked_at: anchor.name,
      landed_at: landed,
      route: routeNames.length > 1 ? routeNames.join(' → ') : null,
      departed_from: name(code(r.ptdepimp) ?? code(r.portdep)),
      voyage_ended_at: name(code(r.portret)),
      mortality_rate: num(r.vymrtrat),
      resistance: ctx.label('ResistanceList', r.resistance),
      captured_by: captor && !['Not captured', 'Unknown'].includes(captor) ? captor : null,
      rig: ctx.label('RigOfVesselList', r.rig),
      tonnage: num(r.tonnage),
      crew_at_outset: num(r.crew1 ?? r.crew),
      crew_died: num(r.crewdied),
      embarked_recorded: num(r.tslavesd),
      year_arrived: num(r.yearam),
      database: DATABASES[db].name,
      figures: 'embarked, disembarked and deaths are SlaveVoyages’ imputed figures where the record is incomplete',
      ...(start.from && { date_from: start.from }),
      placed_at: anchor.placedAt,
      geo_method: anchor.method,
      ...(anchor.confidence !== undefined && { geo_confidence: anchor.confidence }),
      ids: { slavevoyages: r.voyageid.trim() },
    },
  };
}

const PREC_NAME: Record<number, string> = { 1: 'exact', 2: 'city', 3: 'area', 4: 'approximate', 5: 'country' };
const tally = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

function importer(db: keyof typeof DATABASES) {
  const spec = DATABASES[db];
  const file = join(DIR, spec.file);
  return (ctx: Ctx) =>
    importDataset(ctx, { source: spec.source, version: spec.version, asOf: AS_OF, files: [file, PLACES, LABELS], importerVersion: '1' }, async ds => {
      const rep = ds.report;
      const table = placeTable(JSON.parse(readFileSync(PLACES, 'utf8')) as TreeNode[]);
      const labels = JSON.parse(readFileSync(LABELS, 'utf8')) as Labels;
      const byValue = new Map(Object.entries(labels).map(([k, list]) => [k, new Map(list.map(x => [x.value, x.name]))]));
      const geo: GeoIndex | null = openGeoIndex();
      if (!geo) rep.sentinel('no geo-index.db: places without SlaveVoyages coordinates fall back to their region');
      const cache = new Map<string, SvPlace | null>();
      const node = (c: number | null) => (c === null ? undefined : lookup(table, c));
      const at = (c: number | null, role = 'place') => {
        if (c === null) return null;
        const k = `${c}|${role}`;
        if (!cache.has(k)) cache.set(k, locate(geo, node(c), role));
        return cache.get(k)!;
      };
      const label = (list: string, v: string | undefined) => {
        const n = code(v);
        return n === null ? null : (byValue.get(list)?.get(n) ?? null);
      };
      const batch = new EventBatch(ctx, ds);
      const by = { method: {} as Record<string, number>, prec: {} as Record<string, number>, route: { line: 0, point: 0 } };
      for await (const raw of csvRecords(file)) {
        if (raw.__header__) continue;
        rep.rows++;
        const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]));
        const e = voyageEvent(r, db, { node, at, label });
        if ('reject' in e) {
          rep.reject(e.reject, `${r.voyageid} ${r.shipname ?? ''}`.trim());
          continue;
        }
        batch.add(e);
        tally(by.method, e.attrs!.geo_method as string);
        tally(by.prec, PREC_NAME[e.geoPrec]);
        by.route[e.geom ? 'line' : 'point']++;
      }
      for (const [k, p] of cache) if (p?.method === 'resolver') rep.sentinel(`resolver: ${k.split('|')[0]} ${p.name} → ${p.lon.toFixed(3)},${p.lat.toFixed(3)}`);
      rep.extra.placed = by;
      return batch.finish();
    });
}

/**
 * SlaveVoyages (slavevoyages.org): one event per voyage, dated at departure, placed at the principal place where
 * captives were bought, with the port sequence as a line in geom (like IBTrACS' tracks, drawn once lines are).
 */
export const importSlaveVoyages = importer('tast');
export const importSlaveVoyagesIntra = importer('iam');
