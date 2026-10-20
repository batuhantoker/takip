import { createRoute, z, type RouteHandler } from '@hono/zod-openapi';
import { httpJson, optional } from '@takip/connectors/http-json';
import { cachedSource } from '@takip/connectors/source-cache';
import { ErrorBody, json, queryParam } from '../schemas';
import { mergeIdentity, type AdsbdbResponse, type AdsbFiAircraft } from './identity';
import { fetchTrack } from './opensky-track';
import { AircraftDetail, AircraftNotFound } from './schemas';
import { parseTrack } from './trace';

const ADSBDB = 'https://api.adsbdb.com/v0/aircraft';
// adsb.fi's aircraft database is refreshed more often than adsbdb's, so it names airframes adsbdb leaves blank.
const ADSBFI_HEX = 'https://opendata.adsb.fi/api/v2/hex';

// Identity is effectively static, and a track costs OpenSky credits.
const TTL_MS = 2 * 60 * 1000;

export const aircraftRoute = createRoute({
  method: 'get',
  path: '/aircraft',
  tags: ['Aviation'],
  summary: 'Identify an aircraft and its flown track',
  description:
    'Registration, type, model and operator for an airframe, with the path it has flown on the flight in progress ' +
    'and the airports that flight was seen to leave and land at. The track comes from OpenSky while the ' +
    "server's daily OpenSky credits last; adsbdb and adsb.fi name the airframe. Cached for two minutes per airframe.",
  request: {
    query: z.object({
      icao24: queryParam().openapi({
        param: { required: true },
        description: 'The 24-bit ICAO address, as six hex characters.',
        example: 'ae291a',
      }),
    }),
  },
  responses: {
    200: { description: 'What is known about the airframe.', content: json(AircraftDetail) },
    400: { description: 'icao24 is not six hex characters.', content: json(ErrorBody) },
    404: { description: 'No source knows this airframe.', content: json(AircraftNotFound) },
    500: { description: 'The lookup failed.', content: json(ErrorBody) },
  },
});

async function lookUp(icao24: string): Promise<AircraftDetail[]> {
  const [path, db] = await Promise.all([
    optional(fetchTrack(icao24)),
    optional(httpJson<AdsbdbResponse>(`${ADSBDB}/${icao24}`, { timeoutMs: 8000 })),
  ]);

  const ac = db?.response?.aircraft;
  const flown = path?.length ? parseTrack(path) : null;

  let identity = mergeIdentity(ac, null);
  if (!identity.registration || !identity.typeCode) {
    const live = await optional(httpJson<{ ac?: AdsbFiAircraft[] }>(`${ADSBFI_HEX}/${icao24}`, { timeoutMs: 6000 }));
    identity = mergeIdentity(ac, live?.ac?.[0]);
  }

  if (!flown && !identity.registration && !identity.typeCode && !identity.model) return [];

  return [{
    icao24,
    ...identity,
    track: flown?.track || [],
    altitudes: flown?.altitudes || [],
    points: flown?.points || 0,
    departure: flown?.departure || null,
    departureFix: flown?.departureFix || null,
    arrival: flown?.arrival || null,
    source: flown ? 'opensky' : ac ? 'adsbdb' : 'adsb.fi',
  }];
}

export const aircraft: RouteHandler<typeof aircraftRoute> = async c => {
  try {
    const query = c.req.valid('query');
    const icao24 = (query.icao24 || '').trim().toLowerCase();

    if (!/^[0-9a-f]{6}$/.test(icao24)) {
      return c.json({ error: 'icao24 must be a 6-character hex address' }, 400);
    }

    const detail = await cachedSource(`aircraft:${icao24}`, () => lookUp(icao24), TTL_MS)();

    if (!detail.length) return c.json({ error: 'Aircraft not found', icao24 }, 404);

    return c.json(detail[0], 200, { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' });
  } catch (error) {
    console.error('[TAKIP] Aircraft lookup error:', error);
    return c.json({ error: 'Aircraft lookup failed' }, 500);
  }
};
