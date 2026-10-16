import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import type { AppDb } from '../db/app-db';
import { workspaceRoutes } from '../workspaces/routes';
import { arcgisRoutes } from './arcgis/arcgis';
import { aviationRoutes } from './aviation/routes';
import { directionsRoutes } from './directions/routes';
import { entityRoutes } from './entity/expand';
import { geoRoutes } from './geo/routes';
import { marketsRoutes } from './markets/history';
import { regionDossierRoutes } from './region-dossier/region-dossier';
import { satellitesRoutes } from './satellites/orbit';

export const OPENAPI_PATH = '/api/v1/openapi.json';
// Pinned: Scalar's default CDN URL floats to its latest release (several a week).
const SCALAR_CDN = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1';

/** The public API, mounted at /api/v1; its spec and docs are generated from the routes' zod schemas. */
export function v1Routes({ db }: { db: AppDb }) {
  const app = new OpenAPIHono();
  app.route('/geo', geoRoutes());
  app.route('/directions', directionsRoutes());
  app.route('/', aviationRoutes());
  app.route('/', arcgisRoutes());
  app.route('/satellites', satellitesRoutes());
  app.route('/markets', marketsRoutes());
  app.route('/entity', entityRoutes());
  app.route('/', regionDossierRoutes());
  app.route('/', workspaceRoutes(db));

  app.openAPIRegistry.registerComponent('securitySchemes', 'apiKey', {
    type: 'http',
    scheme: 'bearer',
    description: 'An API key from Account settings → API keys (`tk_…`), sent as `Authorization: Bearer tk_…`. Never in the URL. '
      + 'Free accounts get one. Without a key, most endpoints answer `401 api_key_required`; `GET /api/v1/key-policy` lists the ones open to everyone.',
  });
  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'TAKIP API', version: '1' },
    servers: [{ url: '/api/v1' }],
  });
  app.get('/docs', Scalar({ url: OPENAPI_PATH, pageTitle: 'TAKIP API', cdn: SCALAR_CDN }));
  return app;
}
