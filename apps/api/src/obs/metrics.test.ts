import { afterEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../env';
import { parseCidr } from '../net/cidr';
import { startApp, type TestApp } from '../testing/helpers';
import { createMetrics, type Metrics } from './metrics';
import { peerAllowList } from './peer-allow';
import { routeGroup } from './route-group';

let t: TestApp;
let metrics: Metrics;

async function start(metricsAllow: readonly string[] = []) {
  metrics = createMetrics();
  t = await startApp({}, { metrics, metricsAllow });
}

afterEach(() => t?.close());

const peer = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });
const scrape = (address?: string, headers: Record<string, string> = {}) =>
  t.app.request('/metrics', { headers }, address === undefined ? undefined : peer(address));

const byLabels = (values: { labels: Record<string, string | number | undefined>; value: number }[]) =>
  Object.fromEntries(values.map(v => [`${v.labels.method} ${v.labels.route_group} ${v.labels.status}`, v.value]));

const counted = async () => byLabels((await metrics.requests.get()).values);
const timed = async () => byLabels((await metrics.duration.get()).values.filter(v => v.metricName === 'http_request_duration_seconds_count'));

describe('http metrics', () => {
  it('count and time requests by method, route group and status', async () => {
    await start();
    await t.app.request('/health');
    await t.app.request('/health');
    await t.app.request('/api/v1/plans');
    await t.app.request('/api/auth/get-session');
    await t.app.request('/no/such/path?x=1');
    await t.app.request('/health', { method: 'PROPFIND' });

    const expected = {
      'GET health 200': 2,
      'GET v1 200': 1,
      'GET auth 200': 1,
      'GET other 404': 1,
      'OTHER health 404': 1,
    };
    expect(await counted()).toEqual(expected);
    expect(await timed()).toEqual(expected);
    expect(await metrics.registry.metrics()).not.toMatch(/no\/such|x=1|PROPFIND/);
  });

  it('leave runtime metrics to the server', async () => {
    expect(await createMetrics().registry.metrics()).not.toContain('process_cpu');
    expect(await createMetrics({ defaults: true }).registry.metrics()).toContain('process_cpu_seconds_total');
  });
});

describe('routeGroup', () => {
  it('maps every path onto a fixed set of groups', () => {
    const groups = Object.fromEntries([
      '/health', '/metrics', '/api/auth/sign-in/email', '/api/admin/users/u1', '/api/v1/plans',
      '/healthz', '/api/v1', '/api/authx', '/', '/wp-login.php',
    ].map(path => [path, routeGroup(path)]));
    expect(groups).toEqual({
      '/health': 'health',
      '/metrics': 'metrics',
      '/api/auth/sign-in/email': 'auth',
      '/api/admin/users/u1': 'admin',
      '/api/v1/plans': 'v1',
      '/healthz': 'other',
      '/api/v1': 'other',
      '/api/authx': 'other',
      '/': 'other',
      '/wp-login.php': 'other',
    });
  });
});

describe('GET /metrics', () => {
  it('answers loopback peers in either address family', async () => {
    await start();
    for (const address of ['127.0.0.1', '127.9.9.9', '::1', '::ffff:127.0.0.1']) {
      const res = await scrape(address);
      expect(res.status, address).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/^text\/plain; version=0\.0\.4/);
      expect(await res.text()).toContain('# TYPE http_requests_total counter');
    }
  });

  it('answers peers inside METRICS_ALLOW and no others', async () => {
    await start(loadEnv({ METRICS_ALLOW: '10.0.0.0/8, fd00::/8' }).METRICS_ALLOW);
    const status = async (address: string) => (await scrape(address)).status;
    expect(await status('10.1.2.3')).toBe(200);
    expect(await status('::ffff:10.1.2.3')).toBe(200);
    expect(await status('fd12::1')).toBe(200);
    expect(await status('11.0.0.1')).toBe(404);
    expect(await status('fe80::1')).toBe(404);
  });

  it('is a 404 for other peers, an unknown peer, and anything relayed by a proxy', async () => {
    await start();
    const refused = [
      await scrape('192.168.1.5'),
      await scrape('203.0.113.7'),
      await scrape(),
      await scrape('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' }),
      await scrape('127.0.0.1', { forwarded: 'for=203.0.113.7' }),
      await scrape('::1', { 'x-real-ip': '203.0.113.7' }),
    ];
    for (const res of refused) {
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain('http_requests_total');
    }
  });
});

describe('METRICS_ALLOW', () => {
  it('is a comma-separated list of CIDRs, checked at boot', () => {
    expect(loadEnv({}).METRICS_ALLOW).toEqual([]);
    expect(loadEnv({ METRICS_ALLOW: ' 10.0.0.0/8, fd00::/8 ,192.168.1.7' }).METRICS_ALLOW).toEqual(['10.0.0.0/8', 'fd00::/8', '192.168.1.7']);
    for (const bad of ['10.0.0.0/33', '::/129', '10.0.0/8', '10.0.0.0/', '10.0.0.0/8/1', 'localhost', '10.0.0.0/+8']) {
      expect(() => loadEnv({ METRICS_ALLOW: bad }), bad).toThrow(/METRICS_ALLOW/);
    }
  });

  it('matches IPv4-mapped IPv6 peers against IPv4 rules', () => {
    const allowed = peerAllowList(['192.168.0.0/16']);
    expect([allowed('192.168.4.4'), allowed('::ffff:192.168.4.4'), allowed('::ffff:192.169.0.1')]).toEqual([true, true, false]);
    expect([allowed(undefined), allowed(''), allowed('not-an-ip')]).toEqual([false, false, false]);
    expect(parseCidr('fd00::/8')).toEqual({ address: 'fd00::', prefix: 8, type: 'ipv6' });
    expect(() => peerAllowList(['10.0.0.0/33'])).toThrow('not a CIDR: 10.0.0.0/33');
  });
});
