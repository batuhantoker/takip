import { cellOf, parseBoundaries, type Boundary, type BoundaryLookup, type FineLevel, type SubLevel } from './boundaries';

/**
 * Fetching and caching the region pick's outlines in the browser.
 *
 * The fetches are cached for the page's lifetime. A session gives the map hook synchronous answers
 * from what has arrived, starts fetching the rest, and calls back as each piece lands.
 */

let countries: Promise<Boundary[]> | null = null;
const admin1 = new Map<string, Promise<Boundary[]>>();
const fineCells = new Map<string, Promise<Boundary[] | null>>();

/** A rejected fetch is forgotten, so the next attempt retries instead of replaying the failure. */
function cached<T>(map: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let p = map.get(key);
  if (!p) {
    p = load().catch(err => {
      map.delete(key);
      throw err;
    });
    map.set(key, p);
  }
  return p;
}

export function loadCountries(): Promise<Boundary[]> {
  countries ??= fetch('/data/boundaries/countries.json')
    .then(res => {
      if (!res.ok) throw new Error(`countries: HTTP ${res.status}`);
      return res.json();
    })
    .then(fc => parseBoundaries(fc, 'country'))
    .catch(err => {
      countries = null;
      throw err;
    });
  return countries;
}

/** Resolves to [] for a country with no states or provinces on file. */
export function loadAdmin1(countryId: string): Promise<Boundary[]> {
  return cached(admin1, countryId, async () => {
    const res = await fetch(`/data/boundaries/admin1/${encodeURIComponent(countryId)}.json`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`admin1 ${countryId}: HTTP ${res.status}`);
    return parseBoundaries(await res.json(), 'admin1');
  });
}

/** Resolves to null when the country has no outlines at that level. */
export function loadFineCell(iso3: string, level: FineLevel, cell: string): Promise<Boundary[] | null> {
  return cached(fineCells, `${iso3}|${level}|${cell}`, async () => {
    const q = new URLSearchParams({ iso3, level, cell });
    const res = await fetch(`/api/boundaries/fine?${q}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${level} ${iso3} ${cell}: HTTP ${res.status}`);
    const body = await res.json();
    return parseBoundaries(body, level, typeof body.source === 'string' ? body.source : undefined);
  });
}

export interface BoundarySession {
  lookup: BoundaryLookup;
  /** Everything loaded so far at a country's level, for outlining the choices. */
  loaded(country: Boundary, level: SubLevel): Boundary[];
  /** Resolves once nothing is in flight. */
  settled(): Promise<void>;
  close(): void;
}

export function createBoundarySession(onLoad: () => void): BoundarySession {
  const states = new Map<string, Boundary[]>();
  const cells = new Map<string, Boundary[] | null>();
  const merged = new Map<string, Map<string, Boundary>>();
  const requested = new Set<string>();
  const inflight = new Set<Promise<unknown>>();
  let closed = false;

  const track = (key: string, p: Promise<void>) => {
    if (requested.has(key)) return;
    requested.add(key);
    const done = p.finally(() => {
      inflight.delete(done);
      if (!closed) onLoad();
    });
    inflight.add(done);
  };

  // A failed fetch counts as "none at this level" for the session, so the pick falls back to the coarser outline.
  const lookup: BoundaryLookup = (country, level, lng, lat) => {
    if (level === 'admin1') {
      const got = states.get(country.id);
      if (got) return got;
      track(country.id, loadAdmin1(country.id).catch(() => []).then(list => { states.set(country.id, list); }));
      return undefined;
    }
    if (!country.iso3) return null;
    const key = `${country.iso3}|${level}|${cellOf(lng, lat)}`;
    if (cells.has(key)) return cells.get(key);
    const all = `${country.iso3}|${level}`;
    track(key, loadFineCell(country.iso3, level, cellOf(lng, lat)).catch(() => null).then(list => {
      cells.set(key, list);
      if (!list) return;
      const byId = merged.get(all) ?? new Map<string, Boundary>();
      for (const b of list) byId.set(b.id, b);
      merged.set(all, byId);
    }));
    return undefined;
  };

  return {
    lookup,
    loaded: (country, level) =>
      level === 'admin1'
        ? states.get(country.id) ?? []
        : country.iso3 ? [...(merged.get(`${country.iso3}|${level}`)?.values() ?? [])] : [],
    settled: async () => {
      while (inflight.size) await Promise.allSettled([...inflight]);
    },
    close: () => { closed = true; },
  };
}
