import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import type { MetricObjectWithValues, MetricValue, MetricValueWithName } from 'prom-client';
import type { AppDb } from '../db/app-db';
import type { Metrics } from '../obs/metrics';
import { dayStartMs, eachDay, type Range } from './range';

const SNAPSHOT = /^app-\d{4}-\d{2}-\d{2}\.db$/;
const TOP_ACTIONS = 20;

type Metric = MetricObjectWithValues<MetricValue<string> | MetricValueWithName<string>>;

/** The q-quantile of a cumulative histogram ({le → count}), interpolated inside its bucket; past the last bound it is that bound. */
export function quantile(buckets: Map<number, number>, q: number): number | null {
  const bounds = [...buckets.keys()].sort((a, b) => a - b);
  const total = buckets.get(Infinity) ?? 0;
  if (!total) return null;
  const target = q * total;
  let [lower, below] = [0, 0];
  for (const le of bounds) {
    const cum = buckets.get(le)!;
    if (cum >= target) {
      if (le === Infinity) return lower;
      return cum === below ? le : lower + ((le - lower) * (target - below)) / (cum - below);
    }
    [lower, below] = [le, cum];
  }
  return lower;
}

/** Requests, 5xx answers and latency per route group since the api started, from its Prometheus registry. */
export function httpStats(json: Metric[]) {
  const groups = new Map<string, { requests: number; errors: number; buckets: Map<number, number> }>();
  const entry = (group: string) => {
    const found = groups.get(group) ?? { requests: 0, errors: 0, buckets: new Map<number, number>() };
    groups.set(group, found);
    return found;
  };
  for (const v of json.find(m => m.name === 'http_requests_total')?.values ?? []) {
    const e = entry(String(v.labels.route_group));
    e.requests += v.value;
    if (Number(v.labels.status) >= 500) e.errors += v.value;
  }
  for (const v of json.find(m => m.name === 'http_request_duration_seconds')?.values ?? []) {
    if (!('metricName' in v) || !v.metricName?.endsWith('_bucket')) continue;
    const le = v.labels.le === '+Inf' ? Infinity : Number(v.labels.le);
    const { buckets } = entry(String(v.labels.route_group));
    buckets.set(le, (buckets.get(le) ?? 0) + v.value);
  }
  const ms = (s: number | null) => (s == null ? null : Math.round(s * 10_000) / 10);
  return [...groups]
    .map(([group, e]) => ({ group, requests: e.requests, errors: e.errors, p50Ms: ms(quantile(e.buckets, 0.5)), p95Ms: ms(quantile(e.buckets, 0.95)) }))
    .sort((a, b) => b.requests - a.requests || a.group.localeCompare(b.group));
}

/** The nightly app.db snapshots (db/backup.ts); null when there is no backup directory. */
async function backups(dir: string | undefined) {
  if (!dir) return null;
  const names = await readdir(dir).catch(() => null);
  if (!names) return null;
  const files = await Promise.all(names.filter(n => SNAPSHOT.test(n)).map(async name => {
    const s = await stat(join(dir, name));
    return { name, bytes: s.size, at: s.mtimeMs };
  }));
  const latest = files.reduce<(typeof files)[number] | null>((best, f) => (!best || f.at > best.at ? f : best), null);
  return { count: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0), latest: latest && { ...latest, at: Math.round(latest.at) } };
}

/** The api process, its host, its job queue and the console's own records (GET /api/admin/analytics/system). */
export async function system(db: AppDb, r: Range, { metrics, startedAt, backupDir, now }: { metrics?: Metrics; startedAt: number; backupDir?: string; now: number }) {
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
  const count = (sql: string, ...params: unknown[]) => (db.prepare(sql).pluck().get(...params) as number | null) ?? 0;
  const from = dayStartMs(r.first);
  const json = metrics ? ((await metrics.registry.getMetricsAsJSON()) as Metric[]) : [];
  const lag = json.find(m => m.name === 'nodejs_eventloop_lag_mean_seconds')?.values[0]?.value;
  const memory = process.memoryUsage();

  const perDay = <K extends string>(key: K, sql: string) => {
    const days = eachDay(r, day => ({ day, [key]: 0 }) as { day: string } & Record<K, number>);
    for (const row of all<{ day: number; n: number }>(sql, from)) {
      const entry = days[row.day - r.first];
      if (entry) (entry as Record<string, number | string>)[key] = row.n;
    }
    return days;
  };

  return {
    now,
    startedAt,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal, external: memory.external },
    host: { cpus: os.availableParallelism(), load: os.loadavg(), totalMemory: os.totalmem(), freeMemory: os.freemem() },
    eventLoopLagMs: lag == null || Number.isNaN(lag) ? null : Math.round(lag * 10_000) / 10,
    http: httpStats(json),
    // lastError is the newest error still standing: a job that failed for good or is waiting to retry.
    jobs: all<{ kind: string; pending: number; failed: number; done: number; lastDoneAt: number | null; lastError: string | null }>(`
      SELECT kind, count(CASE WHEN done_at IS NULL AND failed_at IS NULL THEN 1 END) AS pending, count(failed_at) AS failed,
             count(done_at) AS done, max(done_at) AS lastDoneAt,
             (SELECT e.last_error FROM job e WHERE e.kind = j.kind AND e.done_at IS NULL AND e.last_error IS NOT NULL
              ORDER BY e.job_id DESC LIMIT 1) AS lastError
      FROM job j GROUP BY kind ORDER BY kind`),
    backups: await backups(backupDir),
    reports: {
      open: count("SELECT count(*) FROM issue_report WHERE status = 'open'"),
      resolved: count("SELECT count(*) FROM issue_report WHERE status = 'resolved'"),
      days: perDay('created', 'SELECT created_at / 86400000 AS day, count(*) AS n FROM issue_report WHERE created_at >= ? GROUP BY 1'),
    },
    audit: {
      days: perDay('events', 'SELECT at / 86400000 AS day, count(*) AS n FROM audit_event WHERE at >= ? GROUP BY 1'),
      actions: all<{ action: string; events: number }>(`
        SELECT action, count(*) AS events FROM audit_event WHERE at >= ? GROUP BY action ORDER BY events DESC, action LIMIT ?`, from, TOP_ACTIONS),
    },
    workspaces: {
      total: count('SELECT count(*) FROM ws_workspace WHERE deleted_at IS NULL'),
      createdInRange: count('SELECT count(*) FROM ws_workspace WHERE created_at >= ?', from),
    },
  };
}
