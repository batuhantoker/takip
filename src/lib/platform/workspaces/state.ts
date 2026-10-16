/**
 * What a saved workspace holds. Mirrors apps/api/src/workspaces/state.ts (WorkspaceStateV1): the api validates
 * it, this side only reads it tolerantly. Every part is optional; a part nobody registered is left out.
 */

export const STATE_VERSION = 1;
export const MAX_STATE_BYTES = 256 * 1024;

export type Basemap = { style?: string; projection?: 'globe' | 'mercator'; theme?: string };
export type Viewport = { lat: number; lng: number; zoom: number; bearing?: number; pitch?: number };
export type TimeState = { mode: 'live' } | { mode: 'replay'; t: number; speed?: number; playing?: boolean };
export type Pin = { kind: string; id: string; label?: string; lat?: number; lng?: number };
/** A drawn area as src/lib/places/areas/aoi-export.ts stores it. */
export type StoredArea = { id: string; name: string; geojson: { type: 'Feature'; geometry: { type: string; coordinates: unknown[] } } } & Record<string, unknown>;
export type StoredPlace = { label: string; lat: number; lng: number; at: number } & Record<string, unknown>;

export type WorkspaceParts = {
  basemap?: Basemap;
  layers?: Record<string, boolean>;
  filters?: Record<string, unknown>;
  viewport?: Viewport;
  time?: TimeState;
  areas?: StoredArea[];
  pins?: Pin[];
  tool?: string | null;
  recentPlaces?: StoredPlace[];
  watchlist?: string[];
};

export type PartName = keyof WorkspaceParts;
export type PartValue<K extends PartName> = Exclude<WorkspaceParts[K], undefined>;
export type WorkspaceStateV1 = { v: typeof STATE_VERSION } & WorkspaceParts;

/** Capture order: equal states serialise to equal strings. */
export const PART_NAMES = [
  'basemap', 'layers', 'filters', 'viewport', 'time', 'areas', 'pins', 'tool', 'recentPlaces', 'watchlist',
] as const satisfies readonly PartName[];

/** The owner's own lists: a shared view never writes them, and the api never shares them. */
export const PRIVATE_PARTS: readonly PartName[] = ['recentPlaces', 'watchlist'];

/** The state, or null when it isn't a version this build reads. */
export function readState(raw: unknown): WorkspaceStateV1 | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return (raw as { v?: unknown }).v === STATE_VERSION ? (raw as WorkspaceStateV1) : null;
}

export const stateBytes = (state: WorkspaceStateV1) => new TextEncoder().encode(JSON.stringify(state)).length;
