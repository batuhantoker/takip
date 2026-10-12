import { z } from '@hono/zod-openapi';

const LngLat = z.tuple([z.number(), z.number()]).openapi({ description: '[lng, lat]' });

export const Airport = z
  .object({
    iata: z.string(),
    icao: z.string(),
    name: z.string(),
    city: z.string(),
    country: z.string(),
    lat: z.number(),
    lng: z.number(),
  })
  .openapi('Airport');

export const DepartureFix = z
  .object({
    lng: z.number(),
    lat: z.number(),
    radiusKm: z.number().openapi({ description: 'The airport it left is within this distance.' }),
  })
  .openapi('DepartureFix');

export const AircraftDetail = z
  .object({
    icao24: z.string(),
    registration: z.string().nullable(),
    typeCode: z.string().nullable().openapi({ description: 'ICAO type designator, such as B738.' }),
    model: z.string().nullable().openapi({ description: 'Full model, such as "BOEING 737-800".' }),
    operator: z.string().nullable().openapi({ description: 'Registered operator.' }),
    track: z.array(LngLat).openapi({ description: 'The flown path, oldest first, thinned to at most 700 points.' }),
    altitudes: z.array(z.number().nullable()).openapi({ description: 'Feet at each track point; null on the ground.' }),
    points: z.number().int(),
    departure: Airport.nullable().openapi({ description: 'The airport this leg was seen to leave.' }),
    departureFix: DepartureFix.nullable().openapi({
      description: 'Where a leg seen from the ground or a low climb began, even when no listed airport is there.',
    }),
    arrival: Airport.nullable().openapi({ description: 'The airport this leg was seen to land at; null while airborne.' }),
    source: z.enum(['adsb.lol', 'adsbdb', 'adsb.fi']),
  })
  .openapi('AircraftDetail');
export type AircraftDetail = z.infer<typeof AircraftDetail>;

export const AircraftNotFound = z.object({ error: z.string(), icao24: z.string() }).openapi('AircraftNotFound');

const RouteFound = z
  .object({
    found: z.literal(true),
    callsign: z.string(),
    icao24: z.string(),
    source: z.enum(['adsbdb', 'hexdb', 'airplaneslive']),
    origin: Airport,
    destination: Airport,
    arc: z.array(LngLat).openapi({ description: 'The great circle from origin to destination, 73 points.' }),
    totalDistanceKm: z.number().int(),
    departureTime: z.string().nullable().openapi({ description: 'Estimated from the position; null without one.' }),
    arrivalTime: z.string().nullable().openapi({ description: 'Estimated from the position; null without one.' }),
    progress: z.number().openapi({ description: 'Share of the distance flown, 0 to 1; 0 without a position.' }),
  })
  .openapi('FlightRoute');

const RouteMissing = z
  .object({ found: z.literal(false), callsign: z.string(), icao24: z.string() })
  .openapi('FlightRouteMissing');

export const FlightRoute = z.discriminatedUnion('found', [RouteFound, RouteMissing]);
export type FlightRoute = z.infer<typeof FlightRoute>;
export type FoundRoute = z.infer<typeof RouteFound>;
