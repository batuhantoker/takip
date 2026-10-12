import type { HttpBindings } from '@hono/node-server';
import type { Handler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';
import { peerAllowList } from './peer-allow';
import { routeGroup } from './route-group';

export type Metrics = ReturnType<typeof createMetrics>;

const LABELS = ['method', 'route_group', 'status'] as const;
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
// A proxy on this host makes every relayed request look like loopback.
const FORWARDED = ['forwarded', 'x-forwarded-for', 'x-real-ip'];

/** `defaults` adds process and runtime metrics; only the server turns it on, since each call installs observers. */
export function createMetrics({ defaults = false } = {}) {
  const registry = new Registry();
  if (defaults) collectDefaultMetrics({ register: registry });
  const requests = new Counter({
    name: 'http_requests_total',
    help: 'HTTP requests answered, by method, route group and status.',
    labelNames: LABELS,
    registers: [registry],
  });
  const duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Time until the response was ready (streamed bodies not included).',
    labelNames: LABELS,
    registers: [registry],
  });
  return { registry, requests, duration };
}

/** Counts and times every request; wraps the whole app. */
export function httpMetrics({ requests, duration }: Metrics) {
  return createMiddleware(async (c, next) => {
    const start = performance.now();
    await next();
    const labels = {
      method: METHODS.has(c.req.method) ? c.req.method : 'OTHER',
      route_group: routeGroup(c.req.path),
      status: String(c.res.status),
    };
    requests.inc(labels);
    duration.observe(labels, (performance.now() - start) / 1000);
  });
}

/** GET /metrics for loopback peers and `allow`; anyone else, or any proxied request, gets a 404. */
export function metricsEndpoint({ registry }: Metrics, allow: readonly string[]): Handler {
  const allowed = peerAllowList(allow);
  return async c => {
    const peer = (c.env as Partial<HttpBindings> | undefined)?.incoming?.socket?.remoteAddress;
    if (!allowed(peer) || FORWARDED.some(name => c.req.header(name) !== undefined)) return c.notFound();
    return c.body(await registry.metrics(), 200, { 'Content-Type': registry.contentType, 'Cache-Control': 'no-store' });
  };
}
