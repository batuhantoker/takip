import { createRoute, OpenAPIHono, z, type RouteHandler } from '@hono/zod-openapi';
import type { AccessEnv, Principal } from '../../access/middleware';
import { upstreamStatus } from '../pass-through';
import { ErrorBody, json, queryParam } from '../schemas';
import { perCallerLimit } from '../throttle';
import { searchCatalog } from './catalog';
import { queryLayer } from './layer-query';
import { ArcgisSearch, FeatureCollection } from './schemas';
import { featureServiceTarget, unsupportedServiceKind } from './service-target';

export const arcgisRoute = createRoute({
  method: 'get',
  path: '/arcgis',
  tags: ['ArcGIS'],
  summary: 'Search ArcGIS Online, or read features from a public ArcGIS service',
  description:
    'With q, searches the ArcGIS Online catalogue for public Feature Services. With service, reads up to 2,000 ' +
    'features from one layer as GeoJSON. service must be an https URL on a host name, never an IP address, whose ' +
    'path is an ArcGIS REST service (…/rest/services/…/FeatureServer or …/MapServer, optionally with a layer and ' +
    '/query); every address it and its redirects resolve to must be public. Service reads are limited to thirty a ' +
    'minute per caller.',
  request: {
    query: z.object({
      q: queryParam().openapi({ description: 'Words to search the catalogue for. Wins over service.', example: 'wildfire' }),
      service: queryParam().openapi({
        description: 'A Feature Service or Map Server URL from a search result. With no layer, the first layer that holds features is read.',
        example: 'https://services1.arcgis.com/example/arcgis/rest/services/Parcels/FeatureServer/0',
      }),
      bbox: queryParam().openapi({ description: 'west,south,east,north in degrees, for either mode.', example: '-105,35,-94,42' }),
    }),
  },
  responses: {
    200: { description: 'Catalogue matches (q), or the layer as GeoJSON (service).', content: json(z.union([ArcgisSearch, FeatureCollection])) },
    400: { description: 'Neither q nor service was given.', content: json(ErrorBody) },
    403: { description: 'service is not a public https ArcGIS service, or resolves to a private address.', content: json(ErrorBody) },
    422: { description: 'The service serves imagery or tiles, or refused the request.', content: json(ErrorBody) },
    429: { description: 'More than thirty service reads in a minute.', content: json(ErrorBody) },
    500: { description: 'The request failed.', content: json(ErrorBody) },
    502: { description: 'ArcGIS answered with an error, or the service could not be described.', content: json(ErrorBody) },
    504: { description: 'ArcGIS did not answer in time.', content: json(ErrorBody) },
    default: { description: "ArcGIS's own error status, passed through.", content: json(ErrorBody) },
  },
});

function arcgis(refused: (principal: Principal) => boolean): RouteHandler<typeof arcgisRoute, AccessEnv> {
  return async c => {
    const { q, service, bbox } = c.req.valid('query');

    if (q) {
      const found = await searchCatalog(q, bbox);
      if ('error' in found) return c.json({ error: found.error }, upstreamStatus(found.status));
      return c.json(found, 200, { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' });
    }

    if (service) {
      const target = featureServiceTarget(service);
      if (!target) {
        const kind = unsupportedServiceKind(service);
        if (kind) {
          return c.json(
            { error: `This is an ArcGIS ${kind} — it serves imagery or tiles rather than map features, so there is nothing to import.` },
            422,
          );
        }
        return c.json({ error: 'service must be an https ArcGIS Feature Service layer URL' }, 403);
      }
      // Services are third parties' own servers: one caller must not hammer one through us.
      if (refused(c.var.principal)) return c.json({ error: 'Rate limit exceeded' }, 429);

      const answer = await queryLayer(target, bbox);
      if (!('geojson' in answer)) return c.json({ error: answer.error } as { error: string }, upstreamStatus(answer.status));
      return c.json(answer.geojson as FeatureCollection, 200, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' });
    }

    return c.json({ error: 'Provide ?q=keyword or ?service=URL' }, 400);
  };
}

export function arcgisRoutes() {
  return new OpenAPIHono<AccessEnv>().openapi(arcgisRoute, arcgis(perCallerLimit(30)));
}
