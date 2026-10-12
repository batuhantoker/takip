import { z } from '@hono/zod-openapi';

export const GeoKind = z.enum(['country', 'region', 'city', 'street', 'address', 'poi', 'place']);
export type GeoKind = z.infer<typeof GeoKind>;

export const GeoResult = z
  .object({
    name: z.string(),
    context: z.string().openapi({ description: 'Up to three parts of the address beneath the name, comma-separated.' }),
    lat: z.number(),
    lng: z.number(),
    kind: GeoKind,
    source: z.enum(['photon', 'nominatim']),
    score: z.number().optional().openapi({ description: 'Nominatim importance, when the hit came from there. Ranking only.' }),
  })
  .openapi('GeoResult');
export type GeoResult = z.infer<typeof GeoResult>;
