import { OpenAPIHono } from '@hono/zod-openapi';
import { reverse, reverseRoute } from './reverse';
import { search, searchRoute } from './search';

export function geoRoutes() {
  return new OpenAPIHono().openapi(searchRoute, search).openapi(reverseRoute, reverse);
}
