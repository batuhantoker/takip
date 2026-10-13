/**
 * Matching a labelled place on the base map to its Wikipedia article. The
 * vector tiles carry names but no Wikidata ids, so the article is found by
 * name near the label, and anything that only resembles the name is refused.
 */

/** `region`s are matched by name alone; the rest by name near the label. */
export type PlaceKind = 'region' | 'place' | 'water' | 'peak' | 'airport' | 'park' | 'poi';

export const PLACE_KINDS: readonly PlaceKind[] = ['region', 'place', 'water', 'peak', 'airport', 'park', 'poi'];

/** Wikipedia geosearch radius, metres (the API caps it at 10 km). */
export const GEO_RADIUS_M: Record<Exclude<PlaceKind, 'region'>, number> = {
  place: 10_000, water: 10_000, peak: 3_000, airport: 6_000, park: 10_000, poi: 1_000,
};

/** How far a name-search hit's coordinates may sit from the label and still count, km. */
export const SEARCH_MAX_KM: Record<Exclude<PlaceKind, 'region'>, number> = {
  place: 25, water: 60, peak: 10, airport: 15, park: 60, poi: 3,
};

export const KIND_LABEL: Record<PlaceKind, string> = {
  region: 'Region', place: 'Place', water: 'Water', peak: 'Peak', airport: 'Airfield', park: 'Protected area', poi: 'Place of interest',
};

/** OpenMapTiles source-layer and class → what kind of lookup the label needs, or null for labels not worth one. */
export function kindOf(sourceLayer: string | undefined, cls: unknown): PlaceKind | null {
  switch (sourceLayer) {
    case 'place':
      return cls === 'country' || cls === 'state' || cls === 'province' || cls === 'continent' ? 'region' : 'place';
    case 'water_name':
      return cls === 'ocean' || cls === 'sea' ? 'region' : 'water';
    // A river's article sits at its source or mouth, often far from the label.
    case 'waterway': return 'region';
    case 'mountain_peak': return 'peak';
    case 'aerodrome_label': return 'airport';
    case 'park': return 'park';
    case 'poi': return 'poi';
    default: return null;
  }
}

/** The names a label carries, English first, each " / "-separated alternative on its own. */
export function namesOf(props: Record<string, unknown>): string[] {
  const raw = [props['name:en'], props.name_en, props.name_int, props['name:latin'], props.name];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    for (const part of v.split(' / ')) {
      const name = part.trim();
      if (name && !out.includes(name)) out.push(name);
    }
  }
  return out.slice(0, 4);
}

/** Lower case, no accents or parentheticals, words separated by single spaces. */
export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** For the shared-word fallback: words that say what a place is rather than which one it is. */
const GENERIC = new Set(['museum', 'muzesi', 'museo', 'musee', 'museu', 'station', 'gare', 'bahnhof', 'airport', 'aeroport', 'flughafen',
  'air', 'base', 'park', 'parc', 'national', 'naturel', 'naturelle', 'reserve', 'regional', 'nature', 'mosque', 'camii', 'church', 'kilisesi',
  'cathedral', 'hospital', 'hastanesi', 'university', 'universitesi', 'college', 'school', 'house', 'tower', 'bridge', 'castle', 'palace',
  'city', 'hall', 'town', 'police', 'fire', 'saint', 'sankt', 'santa', 'san', 'the', 'and', 'del', 'des', 'der', 'die', 'von']);

const distinctive = (normalized: string) => normalized.split(' ').filter(w => w.length >= 4 && !GENERIC.has(w));

/**
 * Titles worth a summary request, best first: an exact name match, then an
 * article whose title starts the name ("Chamonix" for "Chamonix-Mont-Blanc"),
 * then, only within `fuzzyWithinM`, an article sharing a distinctive word with
 * the name ("Galata Mevlevi Lodge Museum" for "Galata Dervish House Museum").
 * Nearest first within each.
 */
export function rankCandidates(names: string[], candidates: { title: string; dist: number }[], fuzzyWithinM = 0): string[] {
  const wanted = names.map(normalizeTitle).filter(Boolean);
  const words = new Set(wanted.flatMap(distinctive));
  const scored: { title: string; dist: number; score: number }[] = [];
  for (const c of candidates) {
    if (/\(disambiguation\)/i.test(c.title)) continue;
    const t = normalizeTitle(c.title.split(',')[0]);
    if (!t) continue;
    if (wanted.includes(t)) scored.push({ ...c, score: 0 });
    else if (t.length >= 4 && wanted.some(w => w.startsWith(`${t} `))) scored.push({ ...c, score: 1 });
    else if (c.dist <= fuzzyWithinM && distinctive(t).some(w => words.has(w))) scored.push({ ...c, score: 2 });
  }
  return scored.sort((a, b) => a.score - b.score || a.dist - b.dist).map(c => c.title).filter((t, i, all) => all.indexOf(t) === i);
}

/** How near an article has to be for the shared-word fallback, metres; 0 turns it off. */
export const FUZZY_WITHIN_M: Record<PlaceKind, number> = { region: 0, place: 0, water: 0, peak: 0, airport: 1_500, park: 0, poi: 150 };

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
