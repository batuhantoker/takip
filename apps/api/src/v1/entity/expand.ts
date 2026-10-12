import { createRoute, OpenAPIHono, z, type RouteHandler } from '@hono/zod-openapi';
import type { AccessEnv, Principal } from '../../access/middleware';
import { loadEnv } from '../../env';
import { upstreamStatus } from '../pass-through';
import { ErrorBody, json, queryParam } from '../schemas';
import { perCallerLimit } from '../throttle';
import { EntityGraph, EntityGraphError, EntityType } from './schemas';

const ALLOWED_TYPES = new Set<string>(EntityType.options);
const FORWARDED = ['registration', 'model', 'icao24'] as const;

// Read on first use: index.ts loads the .env files only after the route modules are imported.
let intelUrl: string | undefined;
const intel = () => (intelUrl ??= loadEnv().INTEL_URL);

export const expandRoute = createRoute({
  method: 'get',
  path: '/expand',
  tags: ['Entities'],
  summary: 'Expand an entity into its graph neighbours',
  description:
    'Asks the TAKIP intelligence service which operators, owners, people, countries and sanctions entries connect ' +
    'to an aircraft, vessel, company, person, IP address or country. Thirty requests a minute per caller.',
  request: {
    query: z.object({
      type: queryParam().openapi({
        param: { required: true },
        description: `One of ${EntityType.options.join(', ')}; any case.`,
        example: 'aircraft',
      }),
      id: queryParam().openapi({ param: { required: true }, description: 'The entity, 2 to 200 characters.', example: 'N381DN' }),
      registration: queryParam().openapi({ description: 'An aircraft registration, passed to the resolver.', example: 'N381DN' }),
      model: queryParam().openapi({ description: 'An aircraft model, passed to the resolver.', example: 'B739' }),
      icao24: queryParam().openapi({ description: "An aircraft's ICAO address, passed to the resolver.", example: 'ae291a' }),
    }),
  },
  responses: {
    200: { description: 'The entity and its neighbours.', content: json(EntityGraph) },
    400: { description: 'type is not one of the types, or id is not 2 to 200 characters.', content: json(ErrorBody) },
    429: { description: 'More than thirty requests in a minute.', content: json(ErrorBody) },
    502: { description: 'The intelligence service could not be reached.', content: json(EntityGraphError) },
    default: { description: "The intelligence service's own error status, passed through.", content: json(EntityGraphError) },
  },
});

function expand(refused: (principal: Principal) => boolean): RouteHandler<typeof expandRoute, AccessEnv> {
  return async c => {
    const { principal } = c.var;
    // Each resolve fans out to Wikidata and the sanctions lists.
    if (refused(principal)) return c.json({ error: 'Rate limit exceeded' }, 429);

    const query = c.req.valid('query');
    const type = (query.type || '').toLowerCase().trim();
    const id = (query.id || '').trim();
    if (!type || !ALLOWED_TYPES.has(type)) {
      return c.json({ error: `Invalid type. Allowed: ${[...ALLOWED_TYPES].join(', ')}` }, 400);
    }
    if (!id || id.length < 2 || id.length > 200) return c.json({ error: 'Invalid id (2-200 chars)' }, 400);

    try {
      const params = new URLSearchParams({ type, id });
      for (const key of FORWARDED) {
        const value = query[key];
        if (value) params.set(key, value);
      }
      const res = await fetch(`${intel()}/resolve?${params}`, {
        signal: AbortSignal.timeout(15000),
        // The service keeps its own per-address limit.
        headers: { 'X-Forwarded-For': principal.ip },
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return c.json(
          { error: body.error || `Intel layer returned ${res.status}`, nodes: [], links: [] },
          upstreamStatus(res.status),
        );
      }

      const graph = (await res.json()) as z.infer<typeof EntityGraph>;
      return c.json(graph, 200, { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' });
    } catch (e) {
      console.error('[TAKIP] Intel proxy error:', e instanceof Error ? e.message : e);
      return c.json({ error: 'Intelligence layer unavailable', nodes: [], links: [] }, 502);
    }
  };
}

export function entityRoutes() {
  return new OpenAPIHono<AccessEnv>().openapi(expandRoute, expand(perCallerLimit(30)));
}
