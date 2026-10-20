import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../../env';

/** The site's gazetteer (data/site/gazetteer.json, tools/site/build-gazetteer.ts): GeoNames' towns of about 15,000 and up. */
export const GEONAMES_ATTRIBUTION = 'GeoNames (CC BY 4.0)';

interface Town {
  label: string;
  lat: number;
  lng: number;
  reach: number;
}

interface GazetteerFile {
  places: { kind: string; name: string; region?: string; cc: string; at: [number, number]; pop: number }[];
}

/** How far a town reaches: 8 km, a metropolis up to 45 km. The same as the place pages' reachKm. */
const reachKm = (pop: number) => Math.min(45, Math.max(8, 10 * (pop / 100_000) ** 0.4));
const MAX_REACH_KM = 45;

function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180;
  const dLng = ((lng2 - lng1 + 540) % 360) - 180;
  return 6371 * Math.hypot(dLng * r * Math.cos(((lat1 + lat2) / 2) * r), (lat2 - lat1) * r);
}

const cellKey = (lat: number, lng: number) => `${Math.floor(lat)},${Math.floor(lng)}`;

let towns: Map<string, Town[]> | null = null;

function load(path: string): Map<string, Town[]> {
  const grid = new Map<string, Town[]>();
  if (!existsSync(path)) return grid;
  const file = JSON.parse(readFileSync(path, 'utf8')) as GazetteerFile;
  const country = new Intl.DisplayNames(['en'], { type: 'region' });
  for (const p of file.places) {
    // A country's `at` is where its label goes, not a town.
    if (p.kind !== 'city') continue;
    const [lng, lat] = p.at;
    const parts = [p.name, p.region, country.of(p.cc) ?? p.cc].filter((x): x is string => !!x);
    const town = { label: parts.filter((x, i) => parts.indexOf(x) === i).join(', '), lat, lng, reach: reachKm(p.pop) };
    const key = cellKey(lat, lng);
    const list = grid.get(key);
    if (list) list.push(town);
    else grid.set(key, [town]);
  }
  return grid;
}

/**
 * "Town, region, country" for the town whose reach holds the point, the nearest for its size; null out of every
 * town's reach (open sea, wilderness, villages far from a town). Answers in microseconds, with no upstream.
 */
export function nearestTown(lat: number, lng: number): string | null {
  towns ??= load(join(loadEnv().TAKIP_DATA_DIR, 'site', 'gazetteer.json'));
  const dLng = Math.ceil(MAX_REACH_KM / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.05)));
  let best: Town | null = null;
  let bestScore = Infinity;
  for (let y = Math.floor(lat) - 1; y <= Math.floor(lat) + 1; y++) {
    for (let x = Math.floor(lng) - dLng; x <= Math.floor(lng) + dLng; x++) {
      for (const town of towns.get(cellKey(y, ((x + 180) % 360 + 360) % 360 - 180)) ?? []) {
        const score = km(lat, lng, town.lat, town.lng) / town.reach;
        if (score <= 1 && score < bestScore) {
          best = town;
          bestScore = score;
        }
      }
    }
  }
  return best?.label ?? null;
}
