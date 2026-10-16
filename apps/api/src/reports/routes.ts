import { createRoute, OpenAPIHono, z, type Hook } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { bucketKey } from '../access/limits';
import type { AccessEnv } from '../access/middleware';
import { createTokenBuckets } from '../access/token-buckets';
import type { AppDb } from '../db/app-db';
import { RequestError } from '../workspaces/schemas';
import { json } from '../v1/schemas';
import { MAX_BODY, NewReport, RateLimited, ReportReceived, ReportTooLarge } from './schemas';
import { reportStore } from './store';

// Five at once, then one every ten minutes, per account, key or visitor's address block.
export const REPORT_BURST = 5;
const REPORT_RATE = 1 / 600;

const TOO_LARGE = { error: 'too_large', limit: MAX_BODY } as const;
const limitBody = bodyLimit({ maxSize: MAX_BODY, onError: c => c.json(TOO_LARGE, 413) });

const createReportRoute = createRoute({
  method: 'post', path: '/reports', tags: ['Reports'], summary: 'Report an issue',
  description: 'Open to visitors and to signed-in users; a key counts as its owner. The admin console lists reports. '
    + `${REPORT_BURST} at once, then one every ten minutes.`,
  middleware: [limitBody] as const,
  request: { body: { content: json(NewReport), required: true } },
  responses: {
    201: { description: 'Received.', content: json(ReportReceived) },
    400: { description: 'The message is too short or too long, or the view is malformed.', content: json(RequestError) },
    413: { description: `The body is over ${MAX_BODY / 1024} KB.`, content: json(ReportTooLarge) },
    429: { description: 'Too many reports; try again after `retry_after` seconds.', content: json(RateLimited) },
  },
});

const invalidRequest: Hook<unknown, AccessEnv, string, unknown> = (result, c) => {
  if (!result.success) return c.json({ error: 'invalid_request', message: z.prettifyError(result.error) }, 400);
};

/** Mounted at /api/v1. */
export function reportRoutes(db: AppDb, { now = () => Date.now(), buckets = createTokenBuckets() } = {}) {
  const store = reportStore(db);
  const app = new OpenAPIHono<AccessEnv>({ defaultHook: invalidRequest });
  // Malformed JSON reaches here as Hono's plain-text 400.
  app.onError((err, c) => {
    if (err instanceof HTTPException && err.status === 400) return c.json({ error: 'invalid_request', message: err.message }, 400);
    throw err;
  });

  app.openapi(createReportRoute, c => {
    const { principal } = c.var;
    // Only well-formed reports spend a token, so a typo doesn't lock the reporter out.
    const taken = buckets.take(bucketKey(principal), REPORT_RATE, REPORT_BURST);
    if (!taken.allowed) return c.json({ error: 'rate_limited', retry_after: taken.retryAfterS } as const, 429, { 'Retry-After': String(taken.retryAfterS) });
    const { message, view = {} } = c.req.valid('json');
    const id = store.add({ userId: principal.kind === 'anon' ? null : principal.userId, message, view, userAgent: c.req.header('user-agent') ?? null, at: now() });
    return c.json({ ok: true, id } as const, 201);
  });

  return app;
}
