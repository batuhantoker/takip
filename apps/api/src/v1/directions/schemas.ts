import { z } from '@hono/zod-openapi';

export const TravelMode = z.enum(['auto', 'bicycle', 'pedestrian']);
export type TravelMode = z.infer<typeof TravelMode>;

const LngLat = z.tuple([z.number(), z.number()]).openapi({ description: '[lng, lat]' });

export const DirectionStep = z
  .object({
    instruction: z.string(),
    distance: z.number().openapi({ description: 'Metres' }),
    duration: z.number().openapi({ description: 'Seconds' }),
    location: LngLat,
    type: z.string().openapi({ description: 'A coarse maneuver kind for the icon, such as depart, left, roundabout or arrive.' }),
  })
  .openapi('DirectionStep');
export type DirectionStep = z.infer<typeof DirectionStep>;

export const ElevationPoint = z
  .object({
    distance: z.number().openapi({ description: 'Metres travelled from the start of the route.' }),
    height: z.number().openapi({ description: 'Metres above sea level.' }),
  })
  .openapi('ElevationPoint');
export type ElevationPoint = z.infer<typeof ElevationPoint>;

export const DirectionsResult = z
  .object({
    provider: z.enum(['valhalla', 'osrm']),
    mode: TravelMode,
    distance: z.number().openapi({ description: 'Metres' }),
    duration: z.number().openapi({ description: 'Seconds' }),
    geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(LngLat) }),
    steps: z.array(DirectionStep),
    hasHighway: z.boolean().optional(),
    hasToll: z.boolean().optional(),
    hasFerry: z.boolean().optional(),
    elevation: z.array(ElevationPoint).optional().openapi({ description: 'Terrain profile; walking and cycling only.' }),
    ascent: z.number().optional().openapi({ description: 'Metres climbed' }),
    descent: z.number().optional().openapi({ description: 'Metres descended' }),
  })
  .openapi('Route');
export type DirectionsResult = z.infer<typeof DirectionsResult>;

export const Directions = DirectionsResult.extend({
  routes: z.array(DirectionsResult).openapi({ description: 'Every route found, best first. The top-level fields repeat routes[0].' }),
}).openapi('Directions');
