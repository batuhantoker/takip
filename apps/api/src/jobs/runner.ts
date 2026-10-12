import type { Logger } from 'pino';
import { silentLogger } from '../obs/logger';
import type { Job, JobQueue } from './queue';

export type JobHandler = (payload: unknown, job: Job) => Promise<void> | void;
export type JobHandlers = Record<string, JobHandler>;

export type RunnerOptions = {
  now?: () => number;
  /** Longer than any handler runs; past it, another poller may take the job over. */
  leaseMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  logger?: Logger;
};

/** Delay before retry n (1-based): base, 2×base, 4×base, … capped at `maxMs`. */
export const backoffMs = (attempt: number, baseMs: number, maxMs: number) => Math.min(maxMs, baseMs * 2 ** (attempt - 1));

/**
 * Runs due jobs by kind. A handler that throws is retried with exponential backoff until the job's
 * max_attempts, then the job is marked failed. Only kinds with a handler here are claimed, so a process
 * that doesn't know a kind leaves it for one that does.
 */
export function createJobRunner(
  queue: JobQueue,
  handlers: JobHandlers,
  { now = () => Date.now(), leaseMs = 5 * 60_000, baseDelayMs = 30_000, maxDelayMs = 60 * 60_000, logger = silentLogger }: RunnerOptions = {},
) {
  const kinds = Object.keys(handlers);

  async function runOne(): Promise<boolean> {
    const job = queue.claim(kinds, leaseMs);
    if (!job) return false;
    const log = logger.child({ job: job.id, kind: job.kind, attempt: job.attempts });
    try {
      await handlers[job.kind](job.payload, job);
      if (!queue.complete(job)) log.warn('job finished after its lease was taken over');
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      if (job.attempts >= job.maxAttempts) {
        queue.fail(job, error);
        log.error({ err }, 'job failed for good');
      } else {
        queue.retry(job, error, now() + backoffMs(job.attempts, baseDelayMs, maxDelayMs));
        log.warn({ err }, 'job failed; will retry');
      }
    }
    return true;
  }

  async function drain(stopping: () => boolean) {
    if (!kinds.length) return 0;
    queue.sweep();
    let ran = 0;
    while (!stopping() && (await runOne())) ran++;
    return ran;
  }

  return {
    /** Runs every job that is due now, one at a time; returns how many ran. */
    runDue: () => drain(() => false),
    /** Polls every `pollMs`. The returned stop() resolves once the job in hand has finished. */
    start(pollMs = 5_000) {
      let stopping = false;
      let inFlight: Promise<unknown> | null = null;
      const tick = () => {
        if (inFlight) return;
        inFlight = drain(() => stopping)
          .catch(err => logger.error({ err }, 'job poll failed'))
          .finally(() => (inFlight = null));
      };
      const timer = setInterval(tick, pollMs);
      timer.unref();
      tick();
      return async () => {
        stopping = true;
        clearInterval(timer);
        await inFlight;
      };
    },
  };
}

export type JobRunner = ReturnType<typeof createJobRunner>;
