import { createMiddleware } from 'hono/factory';
import type { AccessEnv } from '../access/middleware';

/** What a key may be limited to (backend.md §8). A key with no scopes may do whatever its owner's plan allows. */
export const SCOPES = ['read:tracks', 'read:events', 'read:series', 'export'] as const;
export type Scope = (typeof SCOPES)[number];

/** Refuses a key that was limited to other scopes; sessions and visitors pass, other guards apply to them. */
export function requiresScope(scope: Scope) {
  return createMiddleware<AccessEnv>(async (c, next) => {
    const { principal } = c.var;
    if (principal.kind === 'key' && principal.scopes?.length && !principal.scopes.includes(scope)) {
      return c.json({ error: 'insufficient_scope', scope }, 403);
    }
    await next();
  });
}
