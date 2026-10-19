import { createRoute, z, type RouteHandler } from '@hono/zod-openapi';
import { ATTRIBUTION, nominatim } from '@takip/connectors/nominatim';
import { ErrorBody, json, queryParam } from '../schemas';

interface ReverseRow {
  address?: Record<string, string>;
  display_name?: string;
}

/** A tenth of a degree (about 11 km): a moving cursor reuses one answer, and it still names a city. */
const GRID = 10;

async function lookUp(lat: number, lng: number) {
  const row = await nominatim<ReverseRow>('reverse', {
    lat: (Math.round(lat * GRID) / GRID).toFixed(1),
    lon: (Math.round(lng * GRID) / GRID).toFixed(1),
    zoom: '10',
    addressdetails: '1',
  });
  const address = row?.address ?? {};
  const label = [
    address.city || address.town || address.village || address.county,
    address.state || address.region,
    address.country,
  ].filter(Boolean).join(', ');
  return { row, label };
}

/** "City, region, country" for a point, on the same shared grid and cache as GET /reverse; null when Nominatim has none or is busy. */
export async function nameCoordinate(lat: number, lng: number): Promise<string | null> {
  return (await lookUp(lat, lng)).label || null;
}

export const reverseRoute = createRoute({
  method: 'get',
  path: '/reverse',
  tags: ['Geo'],
  summary: 'Name a coordinate',
  description:
    'The "city, region, country" line for a point. The point is rounded to a tenth of a degree, so everyone ' +
    'looking at the same area shares one Nominatim lookup.',
  request: {
    query: z.object({
      lat: queryParam().openapi({ param: { required: true }, description: 'Latitude, -90 to 90.', example: '48.8584' }),
      lng: queryParam().openapi({ param: { required: true }, description: 'Longitude, -180 to 180.', example: '2.2945' }),
    }),
  },
  responses: {
    200: {
      description:
        'The place name, or null when Nominatim has none. A null from a failed or refused lookup is sent with ' +
        'Cache-Control: no-store.',
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

  const { row, label } = await lookUp(lat, lng);

  return c.json(
    { label: label || null, attribution: ATTRIBUTION },
    200,
    // A tenth of a degree does not change: a month at the edge, a day in the browser. Never a failed lookup.
    { 'Cache-Control': row ? 'public, s-maxage=2592000, max-age=86400, stale-while-revalidate=86400' : 'no-store' },
  );
};
