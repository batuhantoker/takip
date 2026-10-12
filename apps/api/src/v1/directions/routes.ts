import { createRoute, OpenAPIHono, z, type RouteHandler } from '@hono/zod-openapi';
import { optional } from '@takip/connectors/http-json';
import { ErrorBody, json, queryParam } from '../schemas';
import { tryOsrm } from './osrm';
import { Directions, TravelMode, type DirectionsResult } from './schemas';
import { fetchElevation, tryValhalla, type AvoidOptions } from './valhalla';

type Point = { lat: number; lng: number };

const point = (example: string, description: string) =>
  queryParam().openapi({ param: { required: true }, description: `${description}, as "lat,lng".`, example });

export const directionsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Directions'],
  summary: 'Plan a route',
  description:
    'Turn-by-turn directions from Valhalla, with up to two alternatives. Driving falls back to OSRM when Valhalla ' +
    'fails twice; walking and cycling add a terrain profile.',
  request: {
    query: z.object({
      from: point('52.517,13.3888', 'Start'),
      to: point('52.5294,13.3897', 'Destination'),
      mode: queryParam().openapi({ description: 'auto, bicycle or pedestrian. Anything else means auto.', example: 'auto' }),
      via: queryParam().openapi({ description: 'Stops in order, as "lat,lng|lat,lng". Unreadable stops are skipped.', example: '52.52,13.39' }),
      avoid: queryParam().openapi({ description: 'Comma-separated: tolls, highways, ferries. Avoided where another way exists.', example: 'tolls,ferries' }),
    }),
  },
  responses: {
    200: { description: 'The best route, with every route found in routes.', content: json(Directions) },
    400: { description: 'from or to is missing or not a valid "lat,lng".', content: json(ErrorBody) },
    500: { description: 'Routing failed.', content: json(ErrorBody) },
    502: { description: 'No engine found a route between the points.', content: json(ErrorBody) },
  },
});

function parsePoint(raw: string | undefined): Point | null {
  if (!raw) return null;
  const [a, b] = raw.split(',').map((n) => parseFloat(n.trim()));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  return { lat: a, lng: b };
}

export const directions: RouteHandler<typeof directionsRoute> = async c => {
  try {
    const query = c.req.valid('query');
    const from = parsePoint(query.from);
    const to = parsePoint(query.to);
    const parsed = TravelMode.safeParse(query.mode || 'auto');
    const mode: TravelMode = parsed.success ? parsed.data : 'auto';

    if (!from || !to) return c.json({ error: 'from and to are required as "lat,lng"' }, 400);

    const via = (query.via || '')
      .split('|')
      .map((s) => parsePoint(s))
      .filter((p): p is Point => p !== null);

    const avoidParam = (query.avoid || '').split(',').map((s) => s.trim());
    const avoid: AvoidOptions = {
      tolls: avoidParam.includes('tolls'),
      highways: avoidParam.includes('highways'),
      ferries: avoidParam.includes('ferries'),
    };

    const points = [from, ...via, to];

    // The public Valhalla refuses bursts now and then; one retry saves walking and cycling, which OSRM cannot route.
    let routes: DirectionsResult[] = [];
    for (let attempt = 0; attempt < 2 && routes.length === 0; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 400));
      try {
        routes = await tryValhalla(points, mode, avoid);
      } catch {
        routes = [];
      }
    }

    // A car route served for a walking request would be wrong, so only driving falls back.
    if (routes.length === 0 && mode === 'auto') {
      try {
        routes = await tryOsrm(points, mode);
      } catch {
        routes = [];
      }
    }

    if (routes.length === 0) return c.json({ error: 'No route found between those points' }, 502);

    // The climb decides whether a route is viable on foot or by bike; driving skips the extra call.
    if (mode !== 'auto') {
      const profile = await optional(fetchElevation(routes[0].geometry.coordinates));
      if (profile) Object.assign(routes[0], profile);
    }

    return c.json({ ...routes[0], routes }, 200, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' });
  } catch (error) {
    console.error('[TAKIP] Directions error:', error);
    return c.json({ error: 'Routing failed' }, 500);
  }
};

export function directionsRoutes() {
  return new OpenAPIHono().openapi(directionsRoute, directions);
}
