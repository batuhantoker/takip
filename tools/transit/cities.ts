// Which cities a feed's vehicles run in, for the transit layer's zoomed-out view.
// Cities are GeoNames' cities15000 (CC BY 4.0): every place of 15,000 people or more.
import { sortModes, type TransitCity, type TransitMode } from '../../src/lib/feeds/transit/modes';

export interface City {
  id: string;
  name: string;
  cc: string;
  lat: number;
  lng: number;
  pop: number;
}

/** geonames.org/export/dump: tab-separated, name in column 1, lat/lng 4–5, country 8, population 14. */
export function parseGeonames(text: string): City[] {
  const out: City[] = [];
  for (const line of text.split('\n')) {
    const c = line.split('\t');
    if (c.length < 15) continue;
    const lat = Number(c[4]), lng = Number(c[5]), pop = Number(c[14]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && pop > 0) out.push({ id: c[0], name: c[1], cc: c[8], lat, lng, pop });
  }
  return out;
}

/** How far a city reaches: a town 8 km, a metropolis up to 45 km, so suburbs fold into their city. */
const reachKm = (pop: number) => Math.min(45, Math.max(8, 10 * (pop / 100_000) ** 0.4));

const KM_PER_DEG = 111.32;

export function createCityIndex(cities: City[]) {
  const cells = new Map<string, City[]>();
  const key = (lat: number, lng: number) => `${Math.floor(lat)},${Math.floor(lng)}`;
  for (const c of cities) {
    const k = key(c.lat, c.lng);
    cells.set(k, [...(cells.get(k) ?? []), c]);
  }
  /** The most populous city whose reach covers the point. */
  return (lat: number, lng: number): City | null => {
    let best: City | null = null;
    const cos = Math.cos((lat * Math.PI) / 180);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const c of cells.get(key(lat + dy, lng + dx)) ?? []) {
        const km = Math.hypot((c.lat - lat) * KM_PER_DEG, (c.lng - lng) * KM_PER_DEG * cos);
        if (km <= reachKm(c.pop) && (!best || c.pop > best.pop)) best = c;
      }
    }
    return best;
  };
}

export interface FeedSample {
  name: string;
  /** Probed vehicles with the mode of their route, where the route was found in routes.txt. */
  vehicles: { lat: number; lng: number; mode?: TransitMode }[];
  /** Every mode in the feed's routes.txt. */
  modes: TransitMode[];
  /** Where to look when the probe found no vehicles (night there). */
  center: [number, number];
  /** Small enough that every city it reaches runs all its modes. */
  local: boolean;
}

/** A feed's handful of vehicles in a city on its fringe is noise: a city needs this share of them. */
const MIN_SHARE = 0.01;
const MIN_VEHICLES = 3;

export function cityCoverage(feeds: FeedSample[], cityAt: (lat: number, lng: number) => City | null): TransitCity[] {
  const out = new Map<string, { city: City; vehicles: number; modes: Set<TransitMode>; operators: Set<string> }>();
  for (const f of feeds) {
    const here = new Map<string, { city: City; n: number; modes: Set<TransitMode> }>();
    const points = f.vehicles.length ? f.vehicles : [{ lat: f.center[1], lng: f.center[0], mode: undefined }];
    for (const v of points) {
      const city = cityAt(v.lat, v.lng);
      if (!city) continue;
      const h = here.get(city.id) ?? { city, n: 0, modes: new Set<TransitMode>() };
      if (f.vehicles.length) h.n++;
      if (v.mode) h.modes.add(v.mode);
      here.set(city.id, h);
    }
    const ranked = [...here.values()].sort((a, b) => b.n - a.n);
    const floor = Math.max(MIN_VEHICLES, f.vehicles.length * MIN_SHARE);
    const kept = ranked.filter((h, i) => h.n >= floor || i === 0);
    for (const h of kept) {
      const modes = h.modes.size ? h.modes : f.local ? new Set(f.modes) : h.modes;
      const o = out.get(h.city.id) ?? { city: h.city, vehicles: 0, modes: new Set<TransitMode>(), operators: new Set<string>() };
      o.vehicles += h.n;
      for (const m of modes) o.modes.add(m);
      o.operators.add(f.name);
      out.set(h.city.id, o);
    }
  }
  return [...out.values()]
    .sort((a, b) => b.vehicles - a.vehicles || b.city.pop - a.city.pop)
    .map(o => ({
      name: o.city.name,
      cc: o.city.cc,
      at: [Math.round(o.city.lng * 1e4) / 1e4, Math.round(o.city.lat * 1e4) / 1e4],
      modes: sortModes(o.modes),
      vehicles: o.vehicles,
      operators: [...o.operators].slice(0, 6),
    }));
}
