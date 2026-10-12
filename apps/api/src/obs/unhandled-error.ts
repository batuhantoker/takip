import type { ErrorHandler } from 'hono';
import type { Logger } from 'pino';

/**
 * A generic 500 carrying the request id; the stack goes to the log once, on the request line (requestLogger
 * reads c.error), instead of Hono's console.error as well. HTTPExceptions keep their own response.
 */
export function unhandledError(logger: Logger): ErrorHandler {
  return (err, c) => {
    if ('getResponse' in err) {
      const res = err.getResponse();
      return c.newResponse(res.body, res);
    }
    // Thrown before requestLogger ran, so no request line will carry it.
    if (!c.get('logger')) logger.error({ err, requestId: c.get('requestId') }, 'unhandled error');
    return c.json({ error: 'internal_error', request_id: c.get('requestId') }, 500);
  };
}
