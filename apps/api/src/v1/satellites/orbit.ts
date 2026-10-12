import { createRoute, OpenAPIHono, z, type RouteHandler } from '@hono/zod-openapi';
import { orbitalPeriodMinutes, orbitPath, splitAtAntimeridian } from '@takip/connectors/orbit';
import { ErrorBody, json, queryParam } from '../schemas';
import { OrbitTrack, OrbitUnavailable } from './schemas';
import { tleCatalogue } from './tle-catalogue';

const MAX_ANCHOR_DRIFT_MS = 7 * 24 * 3600_000;

export const orbitRoute = createRoute({
  method: 'get',
  path: '/orbit',
  tags: ['Satellites'],
  summary: "One satellite's orbit track",
  description:
    'A full revolution propagated with SGP4 from the same TLE the satellites layer placed the satellite with, ' +
    'half a period either side of the anchor, so the track passes through the satellite rather than near it.',
  request: {
    query: z.object({
      id: queryParam().openapi({ param: { required: true }, description: 'NORAD catalogue number, up to six digits.', example: '25544' }),
      t: queryParam().openapi({
        description:
          'Epoch milliseconds to centre the track on: when the caller propagated its marker. ' +
          'Defaults to now; ignored when more than seven days away, where a TLE is no longer accurate.',
        example: '1760300000000',
      }),
    }),
  },
  responses: {
    200: { description: 'The track.', content: json(OrbitTrack) },
    400: { description: 'id is not a numeric NORAD id.', content: json(ErrorBody) },
    404: { description: 'The satellite is not in the TLE catalogue.', content: json(OrbitUnavailable) },
    422: { description: 'SGP4 could not propagate the TLE, as for a decayed orbit.', content: json(OrbitUnavailable) },
  },
});

/**
 * Markers are propagated once, when the layer loads, and never re-polled, so a track drawn around now
 * can start thousands of kilometres from its marker. The caller passes its own epoch instead.
 */
function anchorTime(raw: string | undefined): Date {
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) return new Date();
  return Math.abs(ms - Date.now()) > MAX_ANCHOR_DRIFT_MS ? new Date() : new Date(ms);
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

export const orbit: RouteHandler<typeof orbitRoute> = c => {
  const query = c.req.valid('query');
  const id = query.id?.trim();
  if (!id || !/^\d{1,6}$/.test(id)) return c.json({ error: 'numeric NORAD id required' }, 400);

  const tle = tleCatalogue().get(String(Number(id)));
  if (!tle) return c.json({ error: 'not in catalogue', noradId: id }, 404);

  const periodMinutes = orbitalPeriodMinutes(tle.line2);
  const anchor = anchorTime(query.t);
  const from = periodMinutes ? new Date(anchor.getTime() - (periodMinutes * 60_000) / 2) : anchor;
  const path = orbitPath(tle.line1, tle.line2, 180, from);
  if (path.length < 2) return c.json({ error: 'could not propagate', noradId: id }, 422);

  return c.json(
    {
      noradId: id,
      name: tle.name,
      periodMinutes,
      anchoredAt: anchor.toISOString(),
      segments: splitAtAntimeridian(path).map(run =>
        run.map((p): [number, number, number] => [round(p.lng, 4), round(p.lat, 4), Math.round(p.altKm)]),
      ),
    },
    200,
    // The shape only changes when a fresh TLE lands.
    { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
  );
};

export function satellitesRoutes() {
  return new OpenAPIHono().openapi(orbitRoute, orbit);
}
