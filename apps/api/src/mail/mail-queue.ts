import type { Logger } from 'pino';
import { z } from 'zod';
import type { JobQueue } from '../jobs/queue';
import { createJobRunner } from '../jobs/runner';
import { silentLogger } from '../obs/logger';
import type { EmailSender } from './sender';

export const SEND_EMAIL_JOB = 'email.send';
export const EMAIL_MAX_ATTEMPTS = 6;
/** Retries come 2, 4, 8, 16 and 32 minutes apart: about the hour an emailed link stays valid. */
export const EMAIL_RETRY_BASE_MS = 2 * 60_000;

const MESSAGE = z.object({ to: z.string(), subject: z.string(), text: z.string() });

/**
 * Mail through the `job` table (backend.md §6). `sender` only enqueues, so it returns equally fast whatever the
 * transport does, then runs the queue in the background; a failed send is retried with backoff.
 */
export function createMailQueue(queue: JobQueue, transport: EmailSender, { logger = silentLogger }: { logger?: Logger } = {}) {
  const runner = createJobRunner(
    queue,
    { [SEND_EMAIL_JOB]: payload => transport.send(MESSAGE.parse(payload)) },
    { baseDelayMs: EMAIL_RETRY_BASE_MS, logger },
  );
  let running: Promise<unknown> = Promise.resolve();

  const sender: EmailSender = {
    async send({ to, subject, text }) {
      queue.enqueue(SEND_EMAIL_JOB, { to, subject, text }, { maxAttempts: EMAIL_MAX_ATTEMPTS });
      running = running.then(() => runner.runDue()).catch(err => logger.error({ err }, 'mail queue run failed'));
    },
  };

  return {
    sender,
    runner,
    /** Resolves once the queue runs that `sender` started have finished. */
    settled: () => running,
    /** Polls for retries and for mail left by an earlier process; stop() also waits for the runs `sender` started. */
    start(pollMs?: number) {
      const stop = runner.start(pollMs);
      return async () => {
        await stop();
        await running;
      };
    },
  };
}

export type MailQueue = ReturnType<typeof createMailQueue>;
