import { z } from '@hono/zod-openapi';

export const ArcgisItem = z
  .object({
    id: z.string(),
    title: z.string(),
    url: z.string().nullable().openapi({ description: 'The service URL, to pass back as service.' }),
    snippet: z.string(),
    owner: z.string(),
    numViews: z.number().int(),
    extent: z.array(z.array(z.number())).openapi({ description: '[[west, south], [east, north]], or empty.' }),
    tags: z.array(z.string()),
  })
  .openapi('ArcgisItem');
export type ArcgisItem = z.infer<typeof ArcgisItem>;

export const ArcgisSearch = z.object({ results: z.array(ArcgisItem) }).openapi('ArcgisSearch');

export const FeatureCollection = z
  .looseObject({ type: z.string(), features: z.array(z.unknown()) })
  .openapi('FeatureCollection', { description: 'GeoJSON from the service, as it sent it (at most 2,000 features).' });
export type FeatureCollection = z.infer<typeof FeatureCollection>;
