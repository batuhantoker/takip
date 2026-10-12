import { createRoute, z, type RouteHandler } from '@hono/zod-openapi';
import { json, queryParam } from '../schemas';
import { searchPlaces } from './geocoders';
import { GeoResult } from './schemas';

export const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['Geo'],
  summary: 'Search for places',
  description:
    'Type-ahead place search over Photon, with Nominatim asked as well when Photon finds fewer than three. ' +
    'Results are cached for ten minutes per query and rounded bias.',
  request: {
    query: z.object({
      q: queryParam().openapi({ description: 'What to look for. Fewer than two characters return no results.', example: 'eiffel tow' }),
      lat: queryParam().openapi({ description: 'Latitude to bias results toward; used only with lng.', example: '48.85' }),
      lng: queryParam().openapi({ description: 'Longitude to bias results toward; used only with lat.', example: '2.35' }),
    }),
  },
  responses: {
    200: {
      description: 'Up to eight places, best first. Results are © OpenStreetMap contributors.',
      content: json(z.object({ results: z.array(GeoResult) })),
    },
    500: {
      description: 'The search failed.',
      content: json(z.object({ results: z.array(GeoResult), error: z.string() })),
    },
  },
});

export const search: RouteHandler<typeof searchRoute> = async c => {
  try {
    const query = c.req.valid('query');
    const q = (query.q || '').trim();
    const lat = parseFloat(query.lat || '');
    const lng = parseFloat(query.lng || '');

    if (q.length < 2) return c.json({ results: [] }, 200);

    const results = await searchPlaces(q, lat, lng);
    return c.json({ results }, 200, { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' });
  } catch (error) {
    console.error('[TAKIP] Geosearch error:', error);
    return c.json({ results: [], error: 'Search failed' }, 500);
  }
};
