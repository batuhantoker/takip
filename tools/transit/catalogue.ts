import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Bbox } from '../../src/lib/feeds/transit/view';

export interface Candidate {
  id: string;
  name: string;
  url: string;
  license?: string;
  /** From the catalogue: the static GTFS's stops. */
  known?: Bbox;
  /** The static GTFS zips behind it, for routes.txt. */
  statics: string[];
  /** Listed with trip updates and no vehicle positions. */
  tripsOnly?: boolean;
}

function mdbBbox(r: Record<string, string>): Bbox | undefined {
  const b = ['minimum_longitude', 'minimum_latitude', 'maximum_longitude', 'maximum_latitude'].map(k => Number(r[`location.bounding_box.${k}`] || NaN));
  return b.every(Number.isFinite) && b[0] < b[2] && b[1] < b[3] ? (b as Bbox) : undefined;
}

/** Trip-update feeds whose catalogue row names no static GTFS. */
const STATIC_OF: Record<string, string> = {
  // Île-de-France Mobilités: Paris's metro, RER and trams.
  'mdb-3471': 'https://files.mobilitydatabase.org/tdg-80921/latest.zip',
};

/**
 * Keyless feeds with vehicle positions, and those with trip updates alone (BART, Paris) whose static GTFS
 * no position feed covers: their trains are found from the updates and placed on a stop graph.
 */
export function fromMdb(rows: Record<string, string>[]): Candidate[] {
  const byId = new Map(rows.map(r => [r.id, r]));
  const keyless = rows.filter(r => r.data_type === 'gtfs_rt' && r.status === 'active' && (r['urls.authentication_type'] || '0') === '0');
  const entities = (r: Record<string, string>) => r.entity_type.split('|');
  const statics = (r: Record<string, string>) => r.static_reference.split('|').filter(Boolean);
  const withPositions = new Set(keyless.filter(r => entities(r).includes('vp')).flatMap(statics));
  return keyless
    .filter(r => entities(r).includes('vp') || (entities(r).includes('tu') && !statics(r).some(s => withPositions.has(s))))
    .map(r => ({
      id: r.id,
      name: r.provider || r.name || r.id,
      url: r['urls.direct_download'],
      license: r['urls.license'] || undefined,
      known: mdbBbox(r) ?? statics(r).map(s => byId.get(s)).map(s => s && mdbBbox(s)).find(Boolean),
      statics: [...statics(r).map(s => byId.get(s)).map(s => s?.['urls.latest'] || s?.['urls.direct_download']), STATIC_OF[r.id]].filter((u): u is string => !!u),
      tripsOnly: !entities(r).includes('vp') || undefined,
    }))
    .filter(c => /^https?:\/\//.test(c.url));
}

interface Dmfr {
  feeds?: { id: string; urls?: { realtime_vehicle_positions?: string; static_current?: string }; authorization?: { type?: string }; license?: { url?: string } }[];
  operators?: { name?: string; short_name?: string; associated_feeds?: { feed_onestop_id?: string }[] }[];
}

/** "f-dn5b-cobbavl~rt" → "Cobbavl", "f-corpus~christi~regional~transportation~authority~rt" → "Corpus Christi Regional …". */
export const onestopName = (id: string) => id
  .replace(/^f-/, '').replace(/^[0-9bcdefghjkmnpqrstuvwxyz]{1,9}-/, '').replace(/~rt$/, '')
  .split(/[~-]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

export function fromAtlas(dir: string): Candidate[] {
  const files: Dmfr[] = [];
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    try { files.push(JSON.parse(readFileSync(join(dir, file), 'utf8'))); } catch { /* not every file parses */ }
  }
  // Operators often sit in another file than the feeds they run.
  const operatorOf = new Map<string, string>();
  for (const d of files) for (const o of d.operators ?? []) {
    const name = o.name || o.short_name;
    for (const a of o.associated_feeds ?? []) if (name && a.feed_onestop_id) operatorOf.set(a.feed_onestop_id, name);
  }
  const staticOf = new Map<string, string>();
  for (const d of files) for (const f of d.feeds ?? []) if (f.urls?.static_current) staticOf.set(f.id, f.urls.static_current);
  const out: Candidate[] = [];
  for (const d of files) {
    for (const f of d.feeds ?? []) {
      const url = f.urls?.realtime_vehicle_positions;
      if (!url || f.authorization?.type || !/^https?:\/\//.test(url)) continue;
      const staticId = f.id.replace(/~rt$/, '');
      const name = operatorOf.get(f.id) ?? operatorOf.get(staticId) ?? onestopName(f.id);
      const statics = [f.urls?.static_current, staticOf.get(staticId)].filter((u): u is string => !!u);
      out.push({ id: f.id, name, url, license: f.license?.url || undefined, statics });
    }
  }
  return out;
}

export const normUrl = (u: string) => u.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();

/** Agency names by static GTFS URL, from the Mobility Database and the NTD, for Atlas feeds with no operator record. */
export function agencyNames(mdbCsv: Record<string, string>[], ntd: { agency_name?: string; weblink?: { url?: string } }[]) {
  const names = new Map<string, string>();
  for (const r of mdbCsv) if (r.data_type === 'gtfs' && r.provider && r['urls.direct_download']) names.set(normUrl(r['urls.direct_download']), r.provider);
  for (const r of ntd) if (r.agency_name && r.weblink?.url && !names.has(normUrl(r.weblink.url))) names.set(normUrl(r.weblink.url), r.agency_name);
  return names;
}
