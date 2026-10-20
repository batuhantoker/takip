import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_RECHECK_MS, placeById, placeBySlug, SITE_DATA } from '../places/gazetteer';
import type { Place } from '../places/place';
import type { ComparePairsFile, PairReason, WorldRegion } from './pairs-data';

/** Two countries, in the order their URL names them. */
export interface CountryPair { a: Place; b: Place }

const SEP = '-vs-';

let loaded: { mtime: number; checked: number; why: Map<string, PairReason[]>; byCountry: Map<number, number[]>; regions: Record<string, WorldRegion> } | null = null;

const key = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);

function pairs() {
  const file = join(SITE_DATA, 'compare-pairs.json');
  const now = Date.now();
  if (loaded && now - loaded.checked > DATA_RECHECK_MS) {
    loaded.checked = now;
    if ((existsSync(file) ? statSync(file).mtimeMs : 0) !== loaded.mtime) loaded = null;
  }
  if (!loaded) {
    const mtime = existsSync(file) ? statSync(file).mtimeMs : 0;
    const data: ComparePairsFile = mtime ? JSON.parse(readFileSync(file, 'utf8')) : { generated: '', regions: {}, pairs: [] };
    const byCountry = new Map<number, number[]>();
    for (const [a, b] of data.pairs) {
      byCountry.set(a, [...(byCountry.get(a) ?? []), b]);
      byCountry.set(b, [...(byCountry.get(b) ?? []), a]);
    }
    loaded = { mtime, checked: now, why: new Map(data.pairs.map(([a, b, why]) => [key(a, b), why])), byCountry, regions: data.regions };
  }
  return loaded;
}

/** The URL segment: the two slugs in alphabetical order, so each pair has one address. */
export const pairSlug = (x: Place, y: Place) => (x.slug < y.slug ? `${x.slug}${SEP}${y.slug}` : `${y.slug}${SEP}${x.slug}`);

/**
 * The countries a segment names, and whether it is the pair's own spelling; null when it names no two countries.
 * "turkey-vs-greece" finds the pair and says to send it on to "greece-vs-turkey".
 */
export function parsePairSlug(slug: string): { pair: CountryPair; canonical: boolean } | null {
  const at = slug.indexOf(SEP);
  if (at <= 0 || slug.indexOf(SEP, at + 1) !== -1) return null;
  const a = placeBySlug('country', slug.slice(0, at));
  const b = placeBySlug('country', slug.slice(at + SEP.length));
  if (!a || !b || a.id === b.id) return null;
  return { pair: { a, b }, canonical: slug === pairSlug(a, b) };
}

/** Why a pair is in search, or null for one that renders when asked but stays out of it. */
export const pairReasons = (x: Place, y: Place): PairReason[] | null => pairs().why.get(key(x.id, y.id)) ?? null;

/** The countries a country is compared with in search, most populous first. */
export function comparedWith(country: Place): Place[] {
  return (pairs().byCountry.get(country.id) ?? []).map(placeById).filter((p): p is Place => !!p).sort((p, q) => q.pop - p.pop);
}

/** Every listed pair, for the sitemap. */
export function listedPairs(): CountryPair[] {
  return [...pairs().why.keys()].flatMap(k => {
    const [a, b] = k.split('-').map(Number).map(placeById);
    if (!a || !b) return [];
    return [a.slug < b.slug ? { a, b } : { a: b, b: a }];
  });
}

export const worldRegion = (country: Place): WorldRegion | undefined => pairs().regions[country.cc];
