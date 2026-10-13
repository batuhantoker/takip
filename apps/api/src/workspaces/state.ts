import { z } from '@hono/zod-openapi';

/*
 * What a saved workspace holds (backend.md §10). Every part is optional: the web app saves the parts it has
 * registered. Adding an optional part keeps version 1; changing or removing one means WorkspaceStateV2.
 * Mirrored by src/lib/workspaces/state.ts; backend.md wants this in packages/core.
 */

export const STATE_VERSION = 1;
export const MAX_STATE_BYTES = 256 * 1024;

const Lat = z.number().min(-90).max(90);
const Lng = z.number().min(-360).max(360);
const Key = z.string().min(1).max(64);
// The body is parsed JSON already, so any value here is JSON; the size cap bounds it.
const Json = z.unknown();

const Basemap = z.strictObject({
  style: z.string().max(32).optional(),
  projection: z.enum(['globe', 'mercator']).optional(),
  theme: z.string().max(32).optional(),
}).openapi('WorkspaceBasemap');

const Viewport = z.strictObject({
  lat: Lat,
  lng: Lng,
  zoom: z.number().min(0).max(24),
  bearing: z.number().min(-360).max(360).optional(),
  pitch: z.number().min(0).max(90).optional(),
}).openapi('WorkspaceViewport');

const Time = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('live') }),
  z.strictObject({
    mode: z.literal('replay'),
    t: z.number().int().nonnegative().openapi({ description: 'Epoch ms.' }),
    speed: z.number().positive().max(1_000_000).optional(),
    playing: z.boolean().optional(),
  }),
]).openapi('WorkspaceTime');

// The shape src/lib/areas/aoi-export.ts stores; its derived fields are recomputed by the web app.
const Area = z.looseObject({
  id: z.string().min(1).max(128),
  name: z.string().max(200),
  geojson: z.looseObject({
    type: z.literal('Feature'),
    geometry: z.looseObject({ type: z.string().max(32), coordinates: z.array(Json) }),
  }),
}).openapi('WorkspaceArea');

const Pin = z.strictObject({
  kind: z.string().min(1).max(32).openapi({ example: 'flight' }),
  id: z.string().min(1).max(128),
  label: z.string().max(200).optional(),
  lat: Lat.optional(),
  lng: Lng.optional(),
}).openapi('WorkspacePin');

const RecentPlace = z.looseObject({
  label: z.string().max(200),
  lat: Lat,
  lng: Lng,
  at: z.number().int().nonnegative(),
});

export const WorkspaceStateV1 = z.strictObject({
  v: z.literal(STATE_VERSION),
  basemap: Basemap.optional(),
  layers: z.record(Key, z.boolean()).optional().openapi({ description: 'Layer id → on.' }),
  filters: z.record(Key, Json).optional().openapi({ description: 'Per-layer filter settings, as each layer keeps them.' }),
  viewport: Viewport.optional(),
  time: Time.optional(),
  areas: z.array(Area).max(500).optional().openapi({ description: 'Drawn areas of interest.' }),
  pins: z.array(Pin).max(500).optional(),
  tool: z.string().max(32).nullable().optional().openapi({ description: 'The dock tool open, or null.' }),
  recentPlaces: z.array(RecentPlace).max(50).optional().openapi({ description: 'Private: never in a shared read.' }),
  watchlist: z.array(z.string().regex(/^[\w^=.-]{1,20}$/)).max(100).optional().openapi({ description: 'Market symbols. Private: never in a shared read.' }),
}).openapi('WorkspaceStateV1', { description: `A workspace's map state, at most ${MAX_STATE_BYTES / 1024} KB as JSON.` });

export type WorkspaceState = z.infer<typeof WorkspaceStateV1>;

/** The owner's own lists, left out of what a share link shows. */
const PRIVATE_PARTS = ['recentPlaces', 'watchlist'] as const;

export function withoutPrivateParts(state: WorkspaceState): WorkspaceState {
  const shared = { ...state };
  for (const part of PRIVATE_PARTS) delete shared[part];
  return shared;
}

export const stateBytes = (state: unknown) => Buffer.byteLength(JSON.stringify(state));
