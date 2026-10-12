import { createMiddleware } from 'hono/factory';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

// Strict, so a caller's id can go into logs and headers verbatim.
const VALID = /^[A-Za-z0-9_-]{1,64}$/;

/** Echoes the caller's X-Request-Id when it is well-formed, otherwise mints one. */
export function requestId() {
  return createMiddleware(async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const id = incoming && VALID.test(incoming) ? incoming : crypto.randomUUID();
    c.set('requestId', id);
    await next();
    // Set after next(): a header set before it is lost when a handler returns its own Response (Better Auth does).
    c.header('X-Request-Id', id);
  });
}
