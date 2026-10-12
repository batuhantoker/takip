import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { arcgisRoutes } from './arcgis/arcgis';
import { aviationRoutes } from './aviation/routes';
import { directionsRoutes } from './directions/routes';
import { entityRoutes } from './entity/expand';
import { geoRoutes } from './geo/routes';
import { marketsRoutes } from './markets/history';
import { satellitesRoutes } from './satellites/orbit';

export const OPENAPI_PATH = '/api/v1/openapi.json';
// Pinned: Scalar's default CDN URL floats to its latest release (several a week).
const SCALAR_CDN = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1';

/** The public API, mounted at /api/v1; its spec and docs are generated from the routes' zod schemas. */
export function v1Routes() {
  const app = new OpenAPIHono();
  app.route('/geo', geoRoutes());
  app.route('/directions', directionsRoutes());
  app.route('/', aviationRoutes());
  app.route('/', arcgisRoutes());
  app.route('/satellites', satellitesRoutes());
  app.route('/markets', marketsRoutes());
  app.route('/entity', entityRoutes());

  app.openAPIRegistry.registerComponent('securitySchemes', 'apiKey', {
    type: 'http',
    scheme: 'bearer',
    description: 'An API key from Account settings → API keys (`tk_…`), sent as `Authorization: Bearer tk_…`. Never in the URL.',
  });
  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'TAKIP API', version: '1' },
    servers: [{ url: '/api/v1' }],
  });
  app.get('/docs', Scalar({ url: OPENAPI_PATH, pageTitle: 'TAKIP API', cdn: SCALAR_CDN }));
  return app;
}
