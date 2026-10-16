/**
 * nearby: what OpenStreetMap maps around a place, by kind: military sites, datacenters, dams, power
 * plants, airports, hospitals, embassies, plate readers and more, from the public Overpass API.
 * After God's Eye View's OSM feature queries (src/tools/queries/infrastructure.js, surveillance.js, MIT).
 */
import { km } from '../query/geo';
import type { Lookup, Outcome } from '../tools';
import { clip, fail, numIn, ok, placeOf, postForm, round, str } from './shared';

/** Overpass filters per kind, each a list of `nwr[...]` selectors. */
export const KINDS: Record<string, { label: string; selectors: string[] }> = {
  military: { label: 'military sites', selectors: ['["military"]', '["landuse"="military"]'] },
  datacenter: { label: 'datacenters', selectors: ['["telecom"="data_center"]', '["building"="data_center"]'] },
  dam: { label: 'dams', selectors: ['["waterway"="dam"]'] },
  power_plant: { label: 'power plants', selectors: ['["power"="plant"]'] },
  nuclear: { label: 'nuclear plants', selectors: ['["power"="plant"]["plant:source"="nuclear"]'] },
  substation: { label: 'substations', selectors: ['["power"="substation"]["voltage"]'] },
  refinery: { label: 'refineries', selectors: ['["industrial"="refinery"]', '["man_made"="works"]["product"~"oil|petroleum"]'] },
  airport: { label: 'airports', selectors: ['["aeroway"="aerodrome"]'] },
  heliport: { label: 'heliports', selectors: ['["aeroway"="heliport"]'] },
  port: { label: 'ports', selectors: ['["landuse"="port"]', '["industrial"="port"]', '["harbour"="yes"]'] },
  hospital: { label: 'hospitals', selectors: ['["amenity"="hospital"]'] },
  embassy: { label: 'embassies', selectors: ['["office"="diplomatic"]', '["amenity"="embassy"]'] },
  police: { label: 'police stations', selectors: ['["amenity"="police"]'] },
  fire_station: { label: 'fire stations', selectors: ['["amenity"="fire_station"]'] },
  prison: { label: 'prisons', selectors: ['["amenity"="prison"]'] },
  border_crossing: { label: 'border crossings', selectors: ['["barrier"="border_control"]'] },
  bridge: { label: 'major bridges', selectors: ['["man_made"="bridge"]["name"]'] },
  stadium: { label: 'stadiums', selectors: ['["leisure"="stadium"]'] },
  shelter: { label: 'emergency shelters', selectors: ['["amenity"="shelter"]["shelter_type"="public_shelter"]', '["emergency"="assembly_point"]'] },
  alpr: { label: 'licence-plate readers', selectors: ['["man_made"="surveillance"]["surveillance:type"="ALPR"]'] },
  cctv: { label: 'mapped surveillance cameras', selectors: ['["man_made"="surveillance"]'] },
  monument: { label: 'monuments and memorials', selectors: ['["historic"~"monument|memorial"]["name"]'] },
  park: { label: 'parks', selectors: ['["leisure"="park"]["name"]'] },
  telecom_tower: { label: 'telecom towers', selectors: ['["man_made"~"mast|tower"]["tower:type"="communication"]'] },
};

/** The main instance, then a mirror: either can be down or overloaded for a while. */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

interface OsmElement { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

export function overpassQuery(kind: string, lat: number, lng: number, radiusM: number, max = 200): string {
  const around = `(around:${Math.round(radiusM)},${lat.toFixed(5)},${lng.toFixed(5)})`;
  return `[out:json][timeout:25];(${KINDS[kind].selectors.map(s => `nwr${s}${around};`).join('')});out center tags ${max};`;
}

export async function nearby(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const asked = str(a.kind, 30).toLowerCase().replace(/[\s-]+/g, '_');
  const kind = [asked, asked.replace(/ies$/, 'y'), asked.replace(/s$/, '')].find(k => KINDS[k]) ?? asked;
  if (!KINDS[kind]) return fail('nearby', `Unknown kind "${str(a.kind)}". Kinds: ${Object.keys(KINDS).join(', ')}`);
  const place = await placeOf(lk, a.near ?? a.place);
  if (!place) return fail('nearby', `Could not find "${str(a.near ?? a.place)}" on the map`);
  // Overpass is a shared volunteer service: keep the circle small.
  const radiusKm = numIn(a.radius_km, 1, 50) ?? 15;
  const form = `data=${encodeURIComponent(overpassQuery(kind, place.lat, place.lng, radiusKm * 1000))}`;
  let body: { elements?: OsmElement[] } | null = null;
  for (const url of OVERPASS) {
    body = await postForm<{ elements?: OsmElement[] }>(lk, url, form, signal).catch(() => null);
    if (Array.isArray(body?.elements)) break;
  }
  if (!Array.isArray(body?.elements)) return fail('nearby', 'OpenStreetMap\'s Overpass service did not answer; it is busy at times, so try again shortly');
  const rows = (body?.elements ?? []).map(e => {
    const at = e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null);
    if (!at) return null;
    const t = e.tags ?? {};
    return {
      id: `${e.type}/${e.id}`,
      name: t.name ?? t['name:en'] ?? t.operator ?? KINDS[kind].label.replace(/s$/, ''),
      detail: [t.operator && t.operator !== t.name ? t.operator : '', t.military ?? t['plant:source'] ?? t['surveillance:type'] ?? t.aeroway ?? '', t['plant:output:electricity'] ?? '', t.iata ? `IATA ${t.iata}` : ''].filter(Boolean).join(' · '),
      lat: round(at.lat), lng: round(at.lon),
      km: Math.round(km(place, { lat: at.lat, lng: at.lon }) * 10) / 10,
      url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null).sort((x, y) => x.km - y.km);
  const limit = numIn(a.limit, 1, 50) ?? 15;
  const top = rows.slice(0, limit);
  const label = KINDS[kind].label;
  return ok('nearby', `${rows.length} ${label} mapped within ${radiusKm} km of ${place.name}${rows.length > top.length ? `, nearest ${top.length} shown` : ''}`, {
    kind, place: place.name, radius_km: radiusKm, count: rows.length, items: top,
    note: 'OpenStreetMap is mapped by volunteers: absence here does not mean absence on the ground',
  }, {
    kind: 'find', title: `${rows.length} ${label} near ${place.name}`, subtitle: 'OpenStreetMap',
    items: top.map(r => ({ label: r.name, detail: [r.detail, `${r.km} km`].filter(Boolean).join(' · '), lat: r.lat, lng: r.lng, url: r.url })),
  }, a.show === false || !top.length ? undefined : {
    highlight: { points: top.map(r => ({ lat: r.lat, lng: r.lng, label: clip(r.name, 34) })), area: { lat: place.lat, lng: place.lng, radiusKm, label: place.name } },
    fly: { lat: place.lat, lng: place.lng, zoom: Math.max(6, Math.min(13, Math.log2(40_000 / (radiusKm * 2.4)))) },
  });
}
