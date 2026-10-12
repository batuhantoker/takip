import { createRoute, z, type RouteHandler } from '@hono/zod-openapi';
import { httpJson, optional } from '@takip/connectors/http-json';
import { cachedSource } from '@takip/connectors/source-cache';
import { ErrorBody, json, queryParam } from '../schemas';
import { mergeIdentity, type AdsbdbResponse, type AdsbFiAircraft } from './identity';
import { AircraftDetail, AircraftNotFound } from './schemas';
import { parseTrace, shardFor, type TraceFile } from './trace';

const TRACE_BASE = 'https://adsb.lol/data/traces';
const ADSBDB = 'https://api.adsbdb.com/v0/aircraft';
// adsb.fi's aircraft database is refreshed more often than the one stamped into
// adsb.lol's traces, so it still names airframes those two leave blank.
const ADSBFI_HEX = 'https://opendata.adsb.fi/api/v2/hex';

// Identity is effectively static; the track only matters for the current leg.
const TTL_MS = 2 * 60 * 1000;

export const aircraftRoute = createRoute({
  method: 'get',
  path: '/aircraft',
  tags: ['Aviation'],
  summary: 'Identify an aircraft and its flown track',
  description:
    'Registration, type, model and operator for an airframe, with the path it actually flew on its current leg ' +
    'and the airports that leg was seen to leave and land at. The track comes from adsb.lol trace files; ' +
    'adsbdb and adsb.fi fill in what the traces leave blank. Cached for two minutes per airframe.',
  request: {
    query: z.object({
      icao24: queryParam().openapi({
        param: { required: true },
        description: 'The 24-bit ICAO address, as six hex characters.',
        example: 'ae291a',
      }),
      detail: queryParam().openapi({
        description: '"recent" reads only the recent trace; anything else reads the full 24 hours.',
        example: 'recent',
      }),
      legs: queryParam().openapi({
        description: '"all" keeps the whole 24-hour history; anything else keeps only the leg in progress.',
        example: 'all',
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

function fetchTrace(icao24: string, full: boolean): Promise<TraceFile> {
  const kind = full ? 'full' : 'recent';
  return httpJson<TraceFile>(`${TRACE_BASE}/${shardFor(icao24)}/trace_${kind}_${icao24}.json`, { timeoutMs: 12000 });
}

async function lookUp(icao24: string, full: boolean, legOnly: boolean): Promise<AircraftDetail[]> {
  const [trace, db] = await Promise.all([
    optional(fetchTrace(icao24, full)),
    optional(httpJson<AdsbdbResponse>(`${ADSBDB}/${icao24}`, { timeoutMs: 8000 })),
  ]);

  const ac = db?.response?.aircraft;
  const parsed = trace ? parseTrace(trace, 700, legOnly) : null;

  let identity = mergeIdentity(parsed, ac, null);
  if (!identity.registration || !identity.typeCode) {
    const live = await optional(httpJson<{ ac?: AdsbFiAircraft[] }>(`${ADSBFI_HEX}/${icao24}`, { timeoutMs: 6000 }));
    identity = mergeIdentity(parsed, ac, live?.ac?.[0]);
  }

  if (!parsed && !identity.registration && !identity.typeCode && !identity.model) return [];

  return [{
    icao24,
    ...identity,
    track: parsed?.track || [],
    altitudes: parsed?.altitudes || [],
    points: parsed?.points || 0,
    departure: parsed?.departure || null,
    departureFix: parsed?.departureFix || null,
    arrival: parsed?.arrival || null,
    source: parsed ? 'adsb.lol' : ac ? 'adsbdb' : 'adsb.fi',
  }];
}

export const aircraft: RouteHandler<typeof aircraftRoute> = async c => {
  try {
    const query = c.req.valid('query');
    const icao24 = (query.icao24 || '').trim().toLowerCase();
    const full = query.detail !== 'recent';
    const legOnly = query.legs !== 'all';

    if (!/^[0-9a-f]{6}$/.test(icao24)) {
      return c.json({ error: 'icao24 must be a 6-character hex address' }, 400);
    }

    const key = `aircraft:${icao24}:${full ? 'full' : 'recent'}:${legOnly ? 'leg' : 'all'}`;
    const detail = await cachedSource(key, () => lookUp(icao24, full, legOnly), TTL_MS)();

    if (!detail.length) return c.json({ error: 'Aircraft not found', icao24 }, 404);

    return c.json(detail[0], 200, { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' });
  } catch (error) {
    console.error('[TAKIP] Aircraft lookup error:', error);
    return c.json({ error: 'Aircraft lookup failed' }, 500);
  }
};
