import { OpenAPIHono } from '@hono/zod-openapi';
import { aircraft, aircraftRoute } from './aircraft';
import { flightRoute, flightRouteRoute } from './flight-route';

export function aviationRoutes() {
  return new OpenAPIHono().openapi(aircraftRoute, aircraft).openapi(flightRouteRoute, flightRoute);
}
