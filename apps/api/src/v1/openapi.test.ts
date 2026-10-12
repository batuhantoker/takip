import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, type TestApp } from '../testing/helpers';

type Parameter = { name: string; in: string; required: boolean };
type Operation = { parameters: Parameter[]; responses: Record<string, { content: { 'application/json': { schema: unknown } } }> };
type Spec = {
  openapi: string;
  servers: { url: string }[];
  paths: Record<string, { get?: Operation }>;
  components: { schemas: Record<string, { properties: Record<string, unknown>; required: string[] }> };
};

let t: TestApp;
let spec: Spec;

beforeAll(async () => {
  t = await startApp();
  const res = await t.app.request('/api/v1/openapi.json');
  expect(res.status).toBe(200);
  spec = (await res.json()) as Spec;
});
afterAll(() => t.close());

const params = (path: string) => spec.paths[path].get!.parameters.map(p => `${p.name}${p.required ? '!' : ''}`);
const schemaOf = (path: string, status: number) => spec.paths[path].get!.responses[status].content['application/json'].schema;

describe('GET /api/v1/openapi.json', () => {
  it('is OpenAPI 3.1, served relative to /api/v1', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.servers).toEqual([{ url: '/api/v1' }]);
  });

  it('lists the ported routes with their query parameters', () => {
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(['/geo/search', '/geo/reverse', '/directions', '/aircraft', '/flight-route']),
    );
    expect(params('/geo/search')).toEqual(['q', 'lat', 'lng']);
    expect(params('/geo/reverse')).toEqual(['lat!', 'lng!']);
    expect(params('/directions')).toEqual(['from!', 'to!', 'mode', 'via', 'avoid']);
    expect(params('/aircraft')).toEqual(['icao24!', 'detail', 'legs']);
    expect(params('/flight-route')).toEqual(['callsign!', 'icao24', 'lat', 'lng', 'speed']);
  });

  it('describes every status each route answers with', () => {
    expect(Object.keys(spec.paths['/geo/search'].get!.responses)).toEqual(['200', '500']);
    expect(Object.keys(spec.paths['/geo/reverse'].get!.responses)).toEqual(['200', '400']);
    expect(Object.keys(spec.paths['/directions'].get!.responses)).toEqual(['200', '400', '500', '502']);
    expect(Object.keys(spec.paths['/aircraft'].get!.responses)).toEqual(['200', '400', '404', '500']);
    expect(Object.keys(spec.paths['/flight-route'].get!.responses)).toEqual(['200', '400']);
    expect(schemaOf('/geo/reverse', 400)).toEqual({ $ref: '#/components/schemas/Error' });
  });

  it('carries the response schemas as components', () => {
    expect(schemaOf('/geo/search', 200)).toMatchObject({
      properties: { results: { type: 'array', items: { $ref: '#/components/schemas/GeoResult' } } },
    });
    expect(spec.components.schemas.GeoResult.required).toEqual(['name', 'context', 'lat', 'lng', 'kind', 'source']);
    expect(schemaOf('/directions', 200)).toEqual({ $ref: '#/components/schemas/Directions' });
    expect(Object.keys(spec.components.schemas)).toEqual(
      expect.arrayContaining(['Directions', 'Route', 'DirectionStep', 'ElevationPoint', 'Error']),
    );
    expect(schemaOf('/aircraft', 200)).toEqual({ $ref: '#/components/schemas/AircraftDetail' });
    expect(schemaOf('/aircraft', 404)).toEqual({ $ref: '#/components/schemas/AircraftNotFound' });
    expect(schemaOf('/flight-route', 200)).toMatchObject({
      oneOf: [{ $ref: '#/components/schemas/FlightRoute' }, { $ref: '#/components/schemas/FlightRouteMissing' }],
    });
    expect(spec.components.schemas.Airport.required).toEqual(['iata', 'icao', 'name', 'city', 'country', 'lat', 'lng']);
  });
});

describe('GET /api/v1/docs', () => {
  it('serves the Scalar reference, pointed at the spec', async () => {
    const res = await t.app.request('/api/v1/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/html/);
    const html = await res.text();
    expect(html).toContain('<title>TAKIP API</title>');
    expect(html).toContain('/api/v1/openapi.json');
    expect(html).toContain('cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1');
  });
});
