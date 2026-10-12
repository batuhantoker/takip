import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openAppDb, type AppDb } from '../db/app-db';
import { migrateAppSchema } from '../db/migrations';
import { createJobQueue, type JobQueue } from './queue';
import { backoffMs, createJobRunner, type JobHandlers } from './runner';

const LEASE = 60_000;
const BASE = 30_000;

let db: AppDb;
let queue: JobQueue;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.UTC(2026, 9, 12, 12));
  db = openAppDb(':memory:');
  migrateAppSchema(db);
  queue = createJobQueue(db);
});

afterEach(() => {
  vi.useRealTimers();
  db.close();
});

const runner = (handlers: JobHandlers) => createJobRunner(queue, handlers, { leaseMs: LEASE, baseDelayMs: BASE });
const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);
const row = (id: number) => db.prepare('SELECT attempts, run_at, locked_until, last_error, done_at, failed_at FROM job WHERE job_id = ?').get(id) as {
  attempts: number; run_at: number; locked_until: number | null; last_error: string | null; done_at: number | null; failed_at: number | null;
};

describe('the job runner', () => {
  it('runs a job when it is due, with its payload, once', async () => {
    const seen: unknown[] = [];
    const jobs = runner({ greet: payload => void seen.push(payload) });
    const id = queue.enqueue('greet', { to: 'ada' }, { runAt: Date.now() + 1000 })!;

    expect(await jobs.runDue()).toBe(0);
    advance(1000);
    expect(await jobs.runDue()).toBe(1);
    expect(await jobs.runDue()).toBe(0);
    expect(seen).toEqual([{ to: 'ada' }]);
    expect(row(id)).toMatchObject({ attempts: 1, done_at: Date.now(), locked_until: null, failed_at: null });
  });

  it('retries with exponential backoff, then marks the job failed', async () => {
    let calls = 0;
    const jobs = runner({
      flaky: () => {
        calls++;
        throw new Error(`boom ${calls}`);
      },
    });
    const id = queue.enqueue('flaky', {}, { maxAttempts: 4 })!;

    for (const [attempt, delay] of [[1, BASE], [2, 2 * BASE], [3, 4 * BASE]]) {
      expect(await jobs.runDue()).toBe(1);
      expect(row(id)).toMatchObject({ attempts: attempt, run_at: Date.now() + delay, last_error: `boom ${attempt}`, failed_at: null });
      advance(delay - 1);
      expect(await jobs.runDue()).toBe(0);
      advance(1);
    }
    expect(await jobs.runDue()).toBe(1);
    expect(row(id)).toMatchObject({ attempts: 4, failed_at: Date.now(), last_error: 'boom 4', done_at: null });
    advance(24 * 3_600_000);
    expect(await jobs.runDue()).toBe(0);
    expect(calls).toBe(4);
  });

  it('caps the backoff', () => {
    expect([1, 2, 3, 8, 20].map(n => backoffMs(n, BASE, 3_600_000))).toEqual([30_000, 60_000, 120_000, 3_600_000, 3_600_000]);
  });

  it('completes a job that succeeds after failing', async () => {
    let calls = 0;
    const jobs = runner({ flaky: () => { if (++calls === 1) throw new Error('once'); } });
    const id = queue.enqueue('flaky')!;
    await jobs.runDue();
    advance(BASE);
    await jobs.runDue();
    expect(row(id)).toMatchObject({ attempts: 2, done_at: Date.now(), failed_at: null });
  });

  it('takes over a job whose worker died once its lease expires, and fences the old worker out', async () => {
    const ran: number[] = [];
    const jobs = runner({ work: (_, job) => void ran.push(job.attempts) });
    const id = queue.enqueue('work')!;
    const dead = queue.claim(['work'], LEASE)!;
    expect(row(id).locked_until).toBe(Date.now() + LEASE);

    expect(await jobs.runDue()).toBe(0);
    advance(LEASE);
    expect(await jobs.runDue()).toBe(1);
    expect(ran).toEqual([2]);
    expect(queue.complete(dead)).toBe(false);
    expect(row(id)).toMatchObject({ attempts: 2, done_at: Date.now() });
  });

  it('fails a job whose worker died on its last attempt', async () => {
    const jobs = runner({ work: () => {} });
    const id = queue.enqueue('work', {}, { maxAttempts: 1 })!;
    queue.claim(['work'], LEASE);
    advance(LEASE);
    expect(await jobs.runDue()).toBe(0);
    expect(row(id)).toMatchObject({ attempts: 1, failed_at: Date.now(), last_error: 'lease expired on the last attempt' });
  });

  it('leaves kinds it has no handler for to a process that has one', async () => {
    const id = queue.enqueue('email')!;
    expect(await runner({ other: () => {} }).runDue()).toBe(0);
    expect(row(id)).toMatchObject({ attempts: 0, done_at: null, failed_at: null });
  });

  it('enqueues a dedupe key once', () => {
    expect(queue.enqueue('work', {}, { dedupeKey: 'k' })).not.toBeNull();
    expect(queue.enqueue('work', {}, { dedupeKey: 'k' })).toBeNull();
  });

  it('polls on its interval, and stop() waits for the job in hand', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const done: string[] = [];
    const jobs = runner({
      quick: (payload) => void done.push((payload as { n: string }).n),
      slow: () => new Promise<void>(resolve => (release = () => { done.push('slow'); resolve(); })),
    });
    queue.enqueue('quick', { n: 'first' });
    const stop = jobs.start(1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toEqual(['first']);

    queue.enqueue('quick', { n: 'second' });
    await vi.advanceTimersByTimeAsync(999);
    expect(done).toEqual(['first']);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toEqual(['first', 'second']);

    queue.enqueue('slow');
    queue.enqueue('quick', { n: 'after stop' });
    await vi.advanceTimersByTimeAsync(1000);
    let stopped = false;
    const stopping = stop().then(() => (stopped = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);
    release();
    await stopping;
    expect(done).toEqual(['first', 'second', 'slow']);
  });
});
