import { createMiddleware } from 'hono/factory';
import pino, { type DestinationStream, type LevelWithSilent, type Logger } from 'pino';
import { devStream } from './dev-stream';

declare module 'hono' {
  interface ContextVariableMap {
    logger: Logger;
  }
}

export type LogEnv = { LOG_LEVEL: LevelWithSilent; NODE_ENV: 'development' | 'production' | 'test' };

/** JSON lines, or short `[api] …` lines in development where they share a terminal with Next. */
export function createLogger({ LOG_LEVEL, NODE_ENV }: LogEnv, destination?: DestinationStream): Logger {
  return pino(
    {
      level: LOG_LEVEL,
      // For handlers that log headers through c.var.logger; the request line itself never carries them.
      redact: {
        paths: ['headers.cookie', 'headers.authorization', 'headers["set-cookie"]', 'req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        censor: '[redacted]',
      },
    },
    destination ?? (NODE_ENV === 'development' ? devStream() : undefined),
  );
}

export const silentLogger: Logger = pino({ level: 'silent' });

// Scraped every few seconds; at debug so they don't drown the request log.
const PROBES = new Set(['/health', '/metrics']);
// Better Auth's reset link carries its token in the path, not the query.
const PATH_TOKEN = /(\/reset-password\/)[^/]+/;

/** The path as logged: never the query string, and never a token. */
export const loggedPath = (path: string) => path.replace(PATH_TOKEN, '$1:token');

/** One line per request, plus a request-scoped child logger on c.var.logger. */
export function requestLogger(logger: Logger) {
  return createMiddleware<{ Variables: { principal?: { kind: string } } }>(async (c, next) => {
    const log = logger.child({ requestId: c.var.requestId });
    c.set('logger', log);
    const start = performance.now();
    await next();
    const { status } = c.res;
    const line = {
      method: c.req.method,
      path: loggedPath(c.req.path),
      status,
      durationMs: Math.round((performance.now() - start) * 10) / 10,
      principal: c.var.principal?.kind,
      err: c.error,
    };
    const level = status >= 500 ? 'error' : PROBES.has(c.req.path) ? 'debug' : 'info';
    log[level](line, 'request');
  });
}
