import { createRoute, z, type RouteHandler } from '@hono/zod-openapi';
import { ATTRIBUTION, nominatim, nominatimDelayMs } from '@takip/connectors/nominatim';
import { ErrorBody, json, queryParam } from '../schemas';
import { GEONAMES_ATTRIBUTION, nearestTown } from './nearest-place';

interface ReverseRow {
  address?: Record<string, string>;
  display_name?: string;
}

/** A tenth of a degree (about 11 km): a moving cursor reuses one answer, and it still names a city. */
const GRID = 10;
/** Nominatim sends one request every 2 s, and a pan queues one per cell: callers ask again rather than wait in line. */
const WAIT_MS = 1_000;
/** About how long Nominatim takes to answer once asked, added to the queue's wait when saying when to ask again. */
const ANSWER_MS = 500;

/**
 * A listed town whose reach holds the cell, else Nominatim; `answered` is false for a failed or still-queued lookup.
 * With `waitMs`, the caller is held only when the lookup goes out at once; behind others it is told at once when to
 * ask again (`retryMs`), while the lookup stays queued and fills the cache.
 */
async function lookUp(lat: number, lng: number, waitMs?: number) {
  const cellLat = Math.round(lat * GRID) / GRID;
  const cellLng = Math.round(lng * GRID) / GRID;
  const town = nearestTown(cellLat, cellLng);
  if (town) return { answered: true, label: town, attribution: GEONAMES_ATTRIBUTION };
  const queued = waitMs === undefined ? 0 : nominatimDelayMs();
  const row = await nominatim<ReverseRow>('reverse', {
    lat: cellLat.toFixed(1),
    lon: cellLng.toFixed(1),
    zoom: '10',
    addressdetails: '1',
  }, { waitMs: queued > 0 ? 0 : waitMs });
  const address = row?.address ?? {};
  const label = [
    address.city || address.town || address.village || address.county,
    address.state || address.region,
    address.country,
  ].filter(Boolean).join(', ');
  return { answered: row !== null, label, attribution: ATTRIBUTION, ...(row === null && waitMs !== undefined && { retryMs: queued + ANSWER_MS }) };
}

/** "City, region, country" for a point, on the same shared grid and cache as GET /reverse; null when there is none or Nominatim is busy. */
export async function nameCoordinate(lat: number, lng: number): Promise<string | null> {
  return (await lookUp(lat, lng)).label || null;
}

export const reverseRoute = createRoute({
  method: 'get',
  path: '/reverse',
  tags: ['Geo'],
  summary: 'Name a coordinate',
  description:
    'The "city, region, country" line for a point, rounded to a tenth of a degree. It names the GeoNames place ' +
    '(1,000 people and up) whose reach holds the point; elsewhere it asks Nominatim, and everyone looking ' +
    'at the same area shares that lookup. `attribution` says which answered.',
  request: {
    query: z.object({
      lat: queryParam().openapi({ param: { required: true }, description: 'Latitude, -90 to 90.', example: '48.8584' }),
      lng: queryParam().openapi({ param: { required: true }, description: 'Longitude, -180 to 180.', example: '2.2945' }),
    }),
  },
  responses: {
    200: {
      description:
        'The place name, or null when there is none. A null from a failed, refused or still-queued Nominatim ' +
        'lookup is sent with Cache-Control: no-store; a queued one carries Retry-After, the seconds until the cache ' +
        'should hold its answer.',
      content: json(z.object({ label: z.string().nullable(), attribution: z.string() })),
    },
    400: { description: 'lat or lng is missing or out of range.', content: json(ErrorBody) },
  },
});

export const reverse: RouteHandler<typeof reverseRoute> = async c => {
  const query = c.req.valid('query');
  const lat = parseFloat(query.lat || '');
  const lng = parseFloat(query.lng || '');

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return c.json({ error: 'lat and lng required' }, 400);
  }

  const { answered, label, attribution, retryMs } = await lookUp(lat, lng, WAIT_MS);

  return c.json(
    { label: label || null, attribution },
    200,
    {
      // A tenth of a degree does not change: a month at the edge, a day in the browser. Never a failed lookup.
      'Cache-Control': answered ? 'public, s-maxage=2592000, max-age=86400, stale-while-revalidate=86400' : 'no-store',
      ...(retryMs !== undefined && { 'Retry-After': String(Math.ceil(retryMs / 1000)) }),
    },
  );
};
