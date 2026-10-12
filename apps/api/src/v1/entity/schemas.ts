import { z } from '@hono/zod-openapi';

export const EntityType = z.enum(['aircraft', 'vessel', 'company', 'person', 'ip', 'country']);

const EntityNode = z
  .object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
    properties: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('EntityNode');

const EntityLink = z
  .object({ source: z.string(), target: z.string(), label: z.string() })
  .openapi('EntityLink');

export const EntityGraph = z
  .object({
    nodes: z.array(EntityNode),
    links: z.array(EntityLink),
    entity: z.object({ type: EntityType, id: z.string() }),
    source: z.string(),
    sanctions_index_size: z.number().int(),
    wikidata_cache_hits: z.number().int(),
    timestamp: z.string(),
  })
  .openapi('EntityGraph', { description: "The intelligence service's answer, as it sent it." });

export const EntityGraphError = z
  .object({ error: z.string(), nodes: z.array(EntityNode), links: z.array(EntityLink) })
  .openapi('EntityGraphError');
