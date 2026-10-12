import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { directionsRoutes } from './directions/routes';
import { geoRoutes } from './geo/routes';

export const OPENAPI_PATH = '/api/v1/openapi.json';

/** The public API, mounted at /api/v1; its spec and docs are generated from the routes' zod schemas. */
export function v1Routes() {
  const app = new OpenAPIHono();
  app.route('/geo', geoRoutes());
  app.route('/directions', directionsRoutes());

  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'TAKIP API', version: '1' },
    servers: [{ url: '/api/v1' }],
  });
  app.get('/docs', Scalar({ url: OPENAPI_PATH, pageTitle: 'TAKIP API' }));
  return app;
}
