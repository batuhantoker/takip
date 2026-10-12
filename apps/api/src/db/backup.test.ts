import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccess } from '../access/resolver';
import { DAY_MS, utcDay } from '../access/usage';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { loadEnv } from '../env';
import { createJobQueue, type JobQueue } from '../jobs/queue';
import { createJobRunner } from '../jobs/runner';
import { createLogger } from '../obs/logger';
import { AUTH_SECRET, Inbox, Jar, ORIGIN, USER, linkIn } from '../testing/helpers';
import { openAppDb, type AppDb } from './app-db';
import { backupJobs, checkSnapshot, scheduleBackup, snapshotAppDb } from './backup';
import { migrateAppSchema } from './migrations';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const NEXT_RUN = (utcDay(NOW) + 1) * DAY_MS + 2 * 3_600_000;

let root: string;
let live: string;
let db: AppDb;
let queue: JobQueue;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'takip-backup-'));
  live = join(root, 'db', 'app.db');
  db = openAppDb(live);
  migrateAppSchema(db);
  queue = createJobQueue(db);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  db.close();
  rmSync(root, { recursive: true, force: true });
});

const backups = () => join(root, 'backups');
const snapshot = (day: string) => join(backups(), `app-${day}.db`);
const files = () => readdirSync(backups()).sort();
const runner = (keep?: number, logger?: Logger) => createJobRunner(queue, backupJobs({ db, queue, dir: backups(), keep, logger }));
const audit = (action: string) => db.prepare("INSERT INTO audit_event (at, actor_type, actor_id, action, data) VALUES (?, 'system', NULL, ?, '{}')").run(Date.now(), action);
const actionsIn = (file: string) => {
  const copy = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return copy.prepare('SELECT action FROM audit_event ORDER BY audit_id').pluck().all();
  } finally {
    copy.close();
  }
};
const jobRow = (id: number) => db.prepare('SELECT attempts, run_at, last_error, done_at, failed_at FROM job WHERE job_id = ?').get(id);

describe('the nightly app.db snapshot', () => {
  it('copies app.db once a UTC day, then at 02:00 UTC, and logs size and duration', async () => {
    const raw: string[] = [];
    const jobs = runner(undefined, createLogger({ LOG_LEVEL: 'info', NODE_ENV: 'production' }, { write: line => void raw.push(line) }));
    audit('before');

    expect(scheduleBackup(queue, Date.now())).not.toBeNull();
    expect(await jobs.runDue()).toBe(1);
    expect(files()).toEqual(['app-2026-10-12.db']);
    // Written while the rows were still in the WAL.
    expect(statSync(`${live}-wal`).size).toBeGreaterThan(0);
    expect(actionsIn(snapshot('2026-10-12'))).toEqual(['before']);
    expect(raw.map(line => JSON.parse(line))).toEqual([expect.objectContaining({
      msg: 'app.db snapshot written', file: snapshot('2026-10-12'), bytes: statSync(snapshot('2026-10-12')).size, ms: expect.any(Number), removed: [],
    })]);

    expect(scheduleBackup(queue, Date.now())).toBeNull();
    vi.setSystemTime(NEXT_RUN - 1);
    expect(await jobs.runDue()).toBe(0);
    vi.setSystemTime(NEXT_RUN);
    audit('after');
    expect(await jobs.runDue()).toBe(1);
    expect(files()).toEqual(['app-2026-10-12.db', 'app-2026-10-13.db']);
    expect(actionsIn(snapshot('2026-10-13'))).toEqual(['before', 'after']);
  });

  it('keeps the newest snapshots and leaves other files alone', async () => {
    mkdirSync(backups());
    writeFileSync(join(backups(), 'notes.txt'), 'mine');
    writeFileSync(join(backups(), 'app.db'), 'mine too');
    const jobs = runner(3);
    scheduleBackup(queue, Date.now());
    for (let day = 0; day < 5; day++) {
      vi.setSystemTime(NOW + day * DAY_MS);
      expect(await jobs.runDue()).toBe(1);
    }
    expect(files()).toEqual(['app-2026-10-14.db', 'app-2026-10-15.db', 'app-2026-10-16.db', 'app.db', 'notes.txt']);
  });

  it('fails the job, so it retries, when the copy fails its integrity check, and leaves nothing behind', async () => {
    const pragma = Database.prototype.pragma;
    const spy = vi.spyOn(Database.prototype, 'pragma').mockImplementation(function (this: AppDb, source: string, options?: Database.PragmaOptions) {
      return source === 'integrity_check' ? [{ integrity_check: 'Page 7: btreeInitPage() returns error code 11' }] : pragma.call(this, source, options);
    });
    const jobs = runner();
    const id = scheduleBackup(queue, Date.now())!;

    expect(await jobs.runDue()).toBe(1);
    expect(jobRow(id)).toMatchObject({ attempts: 1, run_at: Date.now() + 30_000, done_at: null, failed_at: null, last_error: 'snapshot failed its integrity check: Page 7: btreeInitPage() returns error code 11' });
    expect(files()).toEqual([]);

    spy.mockRestore();
    vi.setSystemTime(Date.now() + 30_000);
    expect(await jobs.runDue()).toBe(1);
    expect(files()).toEqual(['app-2026-10-12.db']);
  });

  it('replaces a temporary file a crash left, and an earlier snapshot the same day', () => {
    mkdirSync(backups());
    writeFileSync(`${snapshot('2026-10-12')}.tmp`, 'half a file');
    snapshotAppDb(db, { dir: backups(), keep: 14 });
    audit('later that day');
    snapshotAppDb(db, { dir: backups(), keep: 14 });
    expect(files()).toEqual(['app-2026-10-12.db']);
    expect(actionsIn(snapshot('2026-10-12'))).toEqual(['later that day']);
  });

  it('finds what is wrong with a damaged file', () => {
    const { file } = snapshotAppDb(db, { dir: backups(), keep: 14 });
    expect(checkSnapshot(file)).toEqual({ problems: [], userVersion: db.pragma('user_version', { simple: true }) });

    const pageSize = db.pragma('page_size', { simple: true }) as number;
    const fd = openSync(file, 'r+');
    writeSync(fd, Buffer.alloc(pageSize, 0xa5), 0, pageSize, 2 * pageSize);
    closeSync(fd);
    expect(checkSnapshot(file).problems.length).toBeGreaterThan(0);

    writeFileSync(file, 'not a database at all, '.repeat(200));
    expect(checkSnapshot(file).problems).toEqual([expect.stringMatching(/not a database/)]);
    expect(checkSnapshot(join(root, 'missing.db')).problems).toHaveLength(1);
  });

  it('reads its directory and how many to keep from the environment', () => {
    const env = loadEnv({});
    expect(env.APP_BACKUP_DIR).toMatch(/\/data\/backups$/);
    expect(env.APP_BACKUP_KEEP).toBe(14);
    expect(loadEnv({ APP_BACKUP_DIR: '/srv/backups', APP_BACKUP_KEEP: '30' })).toMatchObject({ APP_BACKUP_DIR: '/srv/backups', APP_BACKUP_KEEP: 30 });
    for (const bad of ['0', '-1', '1.5', 'all']) expect(() => loadEnv({ APP_BACKUP_KEEP: bad }), bad).toThrow(/APP_BACKUP_KEEP/);
  });
});

describe('the restore drill (docs/runbooks/app-db-restore.md)', () => {
  const env = { BETTER_AUTH_URL: ORIGIN, BETTER_AUTH_SECRET: AUTH_SECRET };
  const post = (app: { request: (path: string, init: RequestInit) => Response | Promise<Response> }, path: string, body: unknown) =>
    app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body) });

  it('brings back the rows, the schema version and a working sign-in', async () => {
    const inbox = new Inbox();
    const app = createApp({ auth: await createAuth(db, env, inbox), access: createAccess(db), db });
    expect((await post(app, '/api/auth/sign-up/email', USER)).status).toBe(200);
    expect((await app.request(linkIn(await inbox.next()))).status).toBe(302);
    audit('before the snapshot');
    const version = db.pragma('user_version', { simple: true });
    const { file } = snapshotAppDb(db, { dir: backups(), keep: 14 });
    audit('after the snapshot');

    // 1. Stop the api.  2–3. Choose the snapshot and check it.
    db.close();
    expect(checkSnapshot(file)).toEqual({ problems: [], userVersion: version });
    // 4. Put it at APP_DB_PATH, with no -wal or -shm beside it.
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${live}${suffix}`, { force: true });
    copyFileSync(file, live);
    expect(existsSync(`${live}-wal`)).toBe(false);

    // 5. Start the api.  6. Check user_version, the rows and a sign-in.
    db = openAppDb(live);
    migrateAppSchema(db);
    expect(db.pragma('user_version', { simple: true })).toBe(version);
    expect(db.prepare("SELECT action FROM audit_event WHERE action LIKE '% the snapshot'").pluck().all()).toEqual(['before the snapshot']);
    const restored = createApp({ auth: await createAuth(db, env, new Inbox()), access: createAccess(db), db });
    const jar = new Jar();
    expect(jar.take(await post(restored, '/api/auth/sign-in/email', { email: USER.email, password: USER.password })).status).toBe(200);
    const session = await (await restored.request('/api/auth/get-session', { headers: { cookie: jar.get() } })).json();
    expect(session).toMatchObject({ user: { email: USER.email, emailVerified: true } });
  });
});
