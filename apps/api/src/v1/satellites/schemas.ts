import { z } from '@hono/zod-openapi';

const TrackPoint = z.tuple([z.number(), z.number(), z.number()]).openapi({ description: '[lng, lat, altitude in km]' });

export const OrbitTrack = z
  .object({
    noradId: z.string(),
    name: z.string(),
    periodMinutes: z.number().nullable(),
    anchoredAt: z.string().openapi({ description: 'The moment the track is centred on, ISO 8601: shows whether t was honoured.' }),
    segments: z.array(z.array(TrackPoint)).openapi({
      description: 'One revolution, split where it crosses the antimeridian so each run draws as one line.',
    }),
  })
  .openapi('OrbitTrack');

export const OrbitUnavailable = z.object({ error: z.string(), noradId: z.string() }).openapi('OrbitUnavailable');
