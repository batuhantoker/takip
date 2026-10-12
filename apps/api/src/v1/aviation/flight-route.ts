import { createRoute, z, type RouteHandler } from '@hono/zod-openapi';
import { ErrorBody, json, queryParam } from '../schemas';
import { estimateTimes, greatCirclePoints, haversineKm } from './geodesy';
import { clearCooldowns, fromAdsbdb, fromAirplanesLive, fromHexdb, type RoutePair } from './route-sources';
import { FlightRoute } from './schemas';

const CACHE_HIT_TTL  = 30 * 60 * 1000;
const CACHE_MISS_TTL =  2 * 60 * 1000;
// Without a stored position or times, so each request estimates its own.
const routeCache = new Map<string, { data: FlightRoute; ts: number }>();

/** Test seam: forget every route and every cooldown. */
export function clearFlightRoutes(): void {
  routeCache.clear();
  clearCooldowns();
}

export const flightRouteRoute = createRoute({
  method: 'get',
  path: '/flight-route',
  tags: ['Aviation'],
  summary: 'Find a flight\'s origin and destination',
  description:
    'The scheduled route for a callsign, from whichever of ADSBDB, HexDB and airplanes.live answers first, with ' +
    'the great-circle arc between the airports. Given the aircraft\'s position, a route it is nowhere near is ' +
    'rejected, and departure, arrival and progress are estimated. Found routes are cached for 30 minutes per ' +
    'callsign, misses for 2.',
  request: {
    query: z.object({
      callsign: queryParam().openapi({
        param: { required: true },
        description: 'The callsign the aircraft broadcasts. Case and surrounding spaces are ignored.',
        example: 'BAW117',
      }),
      icao24: queryParam().openapi({ description: 'The hex address, which airplanes.live looks up by.', example: '4007f5' }),
      lat: queryParam().openapi({ description: 'The aircraft\'s latitude now; used only with lng.', example: '51.2' }),
      lng: queryParam().openapi({ description: 'The aircraft\'s longitude now; used only with lat.', example: '-20.5' }),
      speed: queryParam().openapi({ description: 'Ground speed in knots. At 50 or below, or missing, 800 km/h is assumed.', example: '480' }),
    }),
  },
  responses: {
    200: { description: 'The route, or found: false when no source has a plausible one.', content: json(FlightRoute) },
    400: { description: 'callsign is missing.', content: json(ErrorBody) },
  },
});

/** A route whose ends are under 30 km apart, or more than 1.5 route lengths from the aircraft, is bad data. */
function implausible({ origin, destination }: RoutePair, callsign: string, lat: number, lng: number): boolean {
  const routeDist = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
  if (routeDist < 30) return true;
  const distToOrigin = haversineKm(lat, lng, origin.lat, origin.lng);
  const distToDest = haversineKm(lat, lng, destination.lat, destination.lng);
  const maxReasonable = routeDist * 1.5;
  if (distToOrigin > maxReasonable && distToDest > maxReasonable) {
    console.warn(`[TAKIP] Route ${callsign} ${origin.icao}→${destination.icao} rejected: plane ${Math.round(distToOrigin)}km from origin, ${Math.round(distToDest)}km from dest, route only ${Math.round(routeDist)}km`);
    return true;
  }
  return false;
}

const airport = ({ iata, icao, name, city, country, lat, lng }: RoutePair['origin']) => ({ iata, icao, name, city, country, lat, lng });

export const flightRoute: RouteHandler<typeof flightRouteRoute> = async c => {
  const query = c.req.valid('query');
  const callsign = (query.callsign || '').trim().toUpperCase();
  const icao24 = (query.icao24 || '').trim().toLowerCase();
  const currentLat = parseFloat(query.lat || '0');
  const currentLng = parseFloat(query.lng || '0');
  const speedKt = parseFloat(query.speed || '0') || null;

  if (!callsign) return c.json({ error: 'callsign required' }, 400);

  const cached = routeCache.get(callsign);
  if (cached) {
    const ttl = cached.data.found ? CACHE_HIT_TTL : CACHE_MISS_TTL;
    if (Date.now() - cached.ts < ttl) {
      const out = { ...cached.data };
      if (out.found && currentLat && currentLng) {
        Object.assign(out, estimateTimes(
          out.origin.lat, out.origin.lng, out.destination.lat, out.destination.lng,
          currentLat, currentLng, speedKt,
        ));
      }
      // Even a remembered miss gets the longer cache here.
      return c.json(out, 200, { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' });
    }
  }

  let route: RoutePair | null = null;
  let source: 'adsbdb' | 'hexdb' | 'airplaneslive' = 'adsbdb';
  try {
    const result = await Promise.any([
      fromAdsbdb(callsign).then(r => ({ ...r, _s: 'adsbdb' as const })),
      fromHexdb(callsign).then(r => ({ ...r, _s: 'hexdb' as const })),
      fromAirplanesLive(icao24, callsign).then(r => ({ ...r, _s: 'airplaneslive' as const })),
    ]);
    route = { origin: result.origin, destination: result.destination };
    source = result._s;
  } catch {
    // Every source failed.
  }

  if (route && currentLat && currentLng && implausible(route, callsign, currentLat, currentLng)) route = null;

  if (!route) {
    const miss = { found: false as const, callsign, icao24 };
    routeCache.set(callsign, { data: miss, ts: Date.now() });
    return c.json(miss, 200, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' });
  }

  const { origin, destination } = route;
  const times = (currentLat && currentLng)
    ? estimateTimes(origin.lat, origin.lng, destination.lat, destination.lng, currentLat, currentLng, speedKt)
    : { departureTime: null, arrivalTime: null, progress: 0 };

  const out = {
    found: true as const, callsign, icao24, source,
    origin: airport(origin),
    destination: airport(destination),
    arc: greatCirclePoints(origin.lat, origin.lng, destination.lat, destination.lng, 72),
    totalDistanceKm: Math.round(haversineKm(origin.lat, origin.lng, destination.lat, destination.lng)),
    ...times,
  };

  routeCache.set(callsign, { data: { ...out, departureTime: null, arrivalTime: null, progress: 0 }, ts: Date.now() });

  if (routeCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of routeCache) {
      if (now - v.ts > CACHE_HIT_TTL * 2) routeCache.delete(k);
    }
  }

  return c.json(out, 200, { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' });
};
