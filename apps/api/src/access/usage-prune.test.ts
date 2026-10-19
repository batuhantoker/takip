import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../env';
import { createJobRunner } from '../jobs/runner';
import { startApp, type TestApp } from '../testing/helpers';
import { DAY_MS, utcDay } from './usage';
import { PRUNE_USAGE_JOB, schedulePruneUsage, usageJobs, type UsageRetention } from './usage-prune';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const TODAY = utcDay(NOW);

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

const seed = (ages: number[]) => {
  const insert = t.db.prepare("INSERT INTO usage_counter (day, subject_type, subject_id, key_id, route_group, requests) VALUES (?, ?, ?, ?, 'geo', 1)");
  for (const age of ages) {
    insert.run(TODAY - age, 'anon', 'visitor', '');
    insert.run(TODAY - age, 'user', 'u1', '');
    insert.run(TODAY - age, 'user', 'u1', 'k1');
  }
};
/** Ages in days, counted from NOW, of the rows left for visitors, users and keys. */
const kept = () => {
  const rows = t.db.prepare('SELECT subject_type AS type, key_id AS key, day FROM usage_counter ORDER BY day DESC').all() as { type: string; key: string; day: number }[];
  const ages = (match: (r: { type: string; key: string }) => boolean) => rows.filter(match).map(r => TODAY - r.day);
  return { anon: ages(r => r.type === 'anon'), user: ages(r => r.type === 'user' && !r.key), key: ages(r => !!r.key) };
};
const runner = (retention?: UsageRetention) => createJobRunner(t.jobs.queue, usageJobs({ db: t.db, queue: t.jobs.queue, retention }));

describe('pruning usage_counter', () => {
  it('runs once a day and deletes only days past 400 for accounts and keys, 35 for visitors', async () => {
    seed([0, 35, 36, 400, 401]);
    const jobs = runner();
    expect(schedulePruneUsage(t.jobs.queue, Date.now())).not.toBeNull();
    expect(await jobs.runDue()).toBe(1);
    expect(kept()).toEqual({ anon: [0, 35], user: [0, 35, 36, 400], key: [0, 35, 36, 400] });

    // A restart the same day queues nothing new; tomorrow's run was queued by today's.
    expect(schedulePruneUsage(t.jobs.queue, Date.now())).toBeNull();
    vi.setSystemTime((TODAY + 1) * DAY_MS + 4 * 3_600_000 - 1);
    expect(await jobs.runDue()).toBe(0);
    vi.setSystemTime((TODAY + 1) * DAY_MS + 4 * 3_600_000);
    expect(await jobs.runDue()).toBe(1);
    expect(kept()).toEqual({ anon: [0], user: [0, 35, 36], key: [0, 35, 36] });
    expect(t.db.prepare('SELECT count(*) FROM job WHERE kind = ? AND done_at IS NULL').pluck().get(PRUNE_USAGE_JOB)).toBe(1);
  });

  it('keeps the windows it is configured with', async () => {
    seed([0, 7, 8, 90, 91]);
    schedulePruneUsage(t.jobs.queue, Date.now());
    await runner({ days: 90, anonDays: 7, activityDays: 90 }).runDue();
    expect(kept()).toEqual({ anon: [0, 7], user: [0, 7, 8, 90], key: [0, 7, 8, 90] });
  });

  it('keeps every kind of user activity for 90 days, visitors\' daily hashes included', async () => {
    const day = (age: number) => TODAY - age;
    const at = (age: number) => (TODAY - age) * DAY_MS;
    for (const age of [0, 90, 91]) {
      for (const [type, id] of [['anon', 'visitor'], ['user', 'u1']]) {
        t.db.prepare('INSERT INTO map_time (day, subject_type, subject_id, minutes, last_tick_at) VALUES (?, ?, ?, 1, 0)').run(day(age), type, id);
        t.db.prepare("INSERT INTO feature_time (day, subject_type, subject_id, feature, minutes) VALUES (?, ?, ?, 'view:map', 1)").run(day(age), type, id);
      }
      t.db.prepare("INSERT INTO activity_hour (day, hour, subject_type, minutes) VALUES (?, 3, 'user', 1)").run(day(age));
      t.db.prepare("INSERT INTO user_hour (user_id, day, hour, minutes) VALUES ('u1', ?, 3, 1)").run(day(age));
      t.db.prepare('INSERT INTO visitor (visitor_id, first_seen_at, last_seen_at) VALUES (?, ?, ?)').run(`v${age}`, at(age), at(age));
      for (const table of ['visitor_day (visitor_id, day, minutes, last_tick_at) VALUES (?, ?, 1, 0)', "visitor_feature (visitor_id, day, feature, minutes) VALUES (?, ?, 'view:map', 1)", 'visitor_hour (visitor_id, day, hour, minutes) VALUES (?, ?, 3, 1)']) {
        t.db.prepare(`INSERT INTO ${table}`).run(`v${age}`, day(age));
      }
      t.db.prepare("INSERT INTO sign_in (user_id, at) VALUES ('u1', ?)").run(at(age));
    }
    schedulePruneUsage(t.jobs.queue, Date.now());
    await runner().runDue();
    const ages = (sql: string) => (t.db.prepare(sql).pluck().all() as number[]).map(d => TODAY - d);
    for (const table of ['map_time', 'feature_time']) {
      for (const type of ['anon', 'user']) expect(ages(`SELECT day FROM ${table} WHERE subject_type = '${type}' ORDER BY day DESC`), `${table} ${type}`).toEqual([0, 90]);
    }
    for (const table of ['activity_hour', 'user_hour', 'visitor_day', 'visitor_feature', 'visitor_hour']) {
      expect(ages(`SELECT day FROM ${table} ORDER BY day DESC`), table).toEqual([0, 90]);
    }
    expect(t.db.prepare('SELECT visitor_id FROM visitor ORDER BY visitor_id').pluck().all()).toEqual(['v0', 'v90']);
    expect((t.db.prepare('SELECT at FROM sign_in ORDER BY at DESC').pluck().all() as number[]).map(ms => TODAY - ms / DAY_MS)).toEqual([0, 90]);
  });

  it('takes its activity window from the configuration', async () => {
    for (const age of [0, 7, 8]) t.db.prepare("INSERT INTO user_hour (user_id, day, hour, minutes) VALUES ('u1', ?, 3, 1)").run(TODAY - age);
    schedulePruneUsage(t.jobs.queue, Date.now());
    await runner({ days: 400, anonDays: 35, activityDays: 7 }).runDue();
    expect((t.db.prepare('SELECT day FROM user_hour ORDER BY day DESC').pluck().all() as number[]).map(d => TODAY - d)).toEqual([0, 7]);
  });

  it('reads its windows from the environment', () => {
    expect(loadEnv({})).toMatchObject({ USAGE_RETENTION_DAYS: 400, USAGE_ANON_RETENTION_DAYS: 35, ACTIVITY_RETENTION_DAYS: 90 });
    expect(loadEnv({ ACTIVITY_RETENTION_DAYS: '30' })).toMatchObject({ ACTIVITY_RETENTION_DAYS: 30 });
    expect(loadEnv({ USAGE_RETENTION_DAYS: '90', USAGE_ANON_RETENTION_DAYS: '7' })).toMatchObject({ USAGE_RETENTION_DAYS: 90, USAGE_ANON_RETENTION_DAYS: 7 });
    for (const bad of ['0', '-1', '1.5', 'forever']) expect(() => loadEnv({ USAGE_ANON_RETENTION_DAYS: bad }), bad).toThrow(/USAGE_ANON_RETENTION_DAYS/);
  });
});
