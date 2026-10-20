import { boundaryTitle, resolvePick, wrapLng, type Boundary, type PickResult } from './areas/boundaries';
import { createBoundarySession, loadCountries } from './areas/boundary-store';

/**
 * The status bar's "Çankaya, Ankara, Turkey" for the point under the pointer.
 *
 * The province and country come from the Natural Earth outlines in the browser, so they follow the pointer
 * as it moves. The town comes from /api/geo/reverse, which is Nominatim behind a shared budget of one
 * request every two seconds: it is asked only once the pointer rests in a cell nobody has named yet.
 */

/** How long the pointer rests in an unnamed cell before its town is asked for, so a pan asks for nothing. */
export const REST_MS = 400;
/** Countries failed to load: try again after this, not on every mouse move. */
const RETRY_MS = 30_000;
const MAX_CELLS = 2_000;
/** The route stops waiting on a busy queue but keeps the lookup queued, so a resting pointer asks again this often. */
export const TOWN_RETRY_MS = 2_000;
export const TOWN_TRIES = 4;

/** The route's 0.1° cell; asking for the centre keeps the URL, and so the browser's cached answer, the same. */
export function geocodeCell(lat: number, lng: number) {
  const cellLat = Math.round(lat * 10) / 10;
  const cellLng = Math.round(wrapLng(lng) * 10) / 10;
  const key = `${cellLat.toFixed(1)},${cellLng.toFixed(1)}`;
  return { key, lat: cellLat, lng: cellLng, url: `/api/geo/reverse?lat=${cellLat.toFixed(1)}&lng=${cellLng.toFixed(1)}` };
}

/** The town from the route's "Town, Region, Country" line; a shorter line has no town to offer. */
export function townOf(label: string | null | undefined): string | null {
  const parts = label?.split(', ') ?? [];
  return parts.length >= 2 ? parts[0] : null;
}

const sameName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' }) === 0;

/**
 * The town named for the cell, then the outlines under the pointer. The town is left out when the cell's
 * centre is in another province, so a border never pairs a town with its neighbour. With no outline under
 * the pointer (open sea, an islet the outlines drop) the route's own line is all there is.
 */
export function pointerPlace(here: PickResult, centre: PickResult, routeLabel: string | null): string {
  if (!here.boundary) return routeLabel ?? '';
  const region = boundaryTitle(here.boundary, here.parents);
  const town = centre.boundary?.id === here.boundary.id ? townOf(routeLabel) : null;
  return town && !region.split(', ').some(name => sameName(name, town)) ? `${town}, ${region}` : region;
}

export interface PointerPlace {
  /** Where the pointer is now; cheap enough for every mouse move. */
  point(lat: number, lng: number): void;
  label(): string;
  subscribe(listener: () => void): () => void;
}

export function createPointerPlace(): PointerPlace {
  let label = '';
  let at: { lat: number; lng: number } | null = null;
  let countries: Boundary[] | null = null;
  let countriesLoading = false;
  let countriesFailedAt = -Infinity;
  let rest: ReturnType<typeof setTimeout> | null = null;
  let retrying: { key: string; asked: number } | null = null;
  /** The route's line per cell; null where it has no name (open sea). */
  const named = new Map<string, string | null>();
  const asking = new Set<string>();
  const listeners = new Set<() => void>();
  const session = createBoundarySession(() => refresh());

  function refresh() {
    if (!at || !listeners.size) return;
    const cell = geocodeCell(at.lat, at.lng);
    const routeLabel = named.get(cell.key) ?? null;
    const next = countries
      ? pointerPlace(
          resolvePick(at.lng, at.lat, 'admin1', countries, session.lookup),
          resolvePick(cell.lng, cell.lat, 'admin1', countries, session.lookup),
          routeLabel,
        )
      : routeLabel ?? '';
    if (next === label) return;
    label = next;
    listeners.forEach(l => l());
  }

  function ensureCountries() {
    if (countries || countriesLoading || Date.now() - countriesFailedAt < RETRY_MS) return;
    countriesLoading = true;
    loadCountries()
      .then(list => { countries = list; refresh(); }, () => { countriesFailedAt = Date.now(); })
      .finally(() => { countriesLoading = false; });
  }

  function askTown(cell: ReturnType<typeof geocodeCell>) {
    if (named.has(cell.key) || asking.has(cell.key)) return;
    asking.add(cell.key);
    fetch(cell.url)
      .then(async res => {
        if (!res.ok) return;
        const body = (await res.json()) as { label?: string | null };
        // A refused, failed or still-queued lookup is sent no-store: ask again rather than take it for open sea.
        if (!body.label && res.headers.get('cache-control')?.includes('no-store')) return retryTown(cell);
        if (named.size >= MAX_CELLS) named.delete(named.keys().next().value!);
        named.set(cell.key, body.label || null);
        refresh();
      })
      .catch(() => { /* the province and country still show */ })
      .finally(() => asking.delete(cell.key));
  }

  // Shares `rest` with follow(), so moving the pointer replaces the retry with its own rest and a fresh count.
  function retryTown(cell: ReturnType<typeof geocodeCell>) {
    const asked = retrying?.key === cell.key ? retrying.asked + 1 : 1;
    if (asked >= TOWN_TRIES || !at || geocodeCell(at.lat, at.lng).key !== cell.key) return;
    retrying = { key: cell.key, asked };
    if (rest) clearTimeout(rest);
    rest = setTimeout(() => { rest = null; askTown(cell); }, TOWN_RETRY_MS);
  }

  // Nothing is fetched while no status bar shows the label: on a phone, or while a timeline replaces it.
  function follow() {
    if (!at || !listeners.size) return;
    ensureCountries();
    refresh();
    if (rest) clearTimeout(rest);
    retrying = null;
    const cell = geocodeCell(at.lat, at.lng);
    rest = named.has(cell.key) ? null : setTimeout(() => askTown(cell), REST_MS);
  }

  return {
    point(lat, lng) {
      at = { lat, lng };
      follow();
    },
    label: () => label,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) follow();
      return () => {
        listeners.delete(listener);
        if (!listeners.size && rest) { clearTimeout(rest); rest = null; }
      };
    },
  };
}
