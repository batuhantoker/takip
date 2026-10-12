import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS } from '../access/usage';
import { openAppDb, type AppDb } from '../db/app-db';
import { migrateAppSchema } from '../db/migrations';
import { createJobQueue, type JobQueue } from '../jobs/queue';
import { Inbox, Jar, USER, linkIn, startApp, tick, type TestApp } from '../testing/helpers';
import { EMAIL_MAX_ATTEMPTS, EMAIL_RETRY_BASE_MS, SEND_EMAIL_JOB, createMailQueue } from './mail-queue';
import type { EmailMessage, EmailSender } from './sender';

const MESSAGE: EmailMessage = { to: 'ada@example.com', subject: 'Confirm', text: 'Open https://example.com/verify?token=t0k3n' };
const BO = { name: 'Bo', email: 'bo@example.com', password: 'another horse battery' };

type Row = { kind: string; payload: string; attempts: number; maxAttempts: number; runAt: number; lastError: string | null; doneAt: number | null; failedAt: number | null };
const jobsIn = (db: AppDb) => db.prepare(`
  SELECT kind, payload, attempts, max_attempts AS maxAttempts, run_at AS runAt, last_error AS lastError, done_at AS doneAt, failed_at AS failedAt
  FROM job ORDER BY job_id`).all() as Row[];

describe('the mail queue', () => {
  let db: AppDb;
  let queue: JobQueue;
  let inbox: Inbox;
  let calls: number;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 12, 12));
    db = openAppDb(':memory:');
    migrateAppSchema(db);
    queue = createJobQueue(db);
    inbox = new Inbox();
    calls = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    db.close();
  });

  const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);
  /** Fails its first `failures` sends, then delivers to the inbox. */
  const transport = (failures: number): EmailSender => ({
    async send(message) {
      if (++calls <= failures) throw new Error(`smtp down ${calls}`);
      await inbox.send(message);
    },
  });

  it('queues each message and sends it straight away', async () => {
    const mail = createMailQueue(queue, transport(0));
    await mail.sender.send(MESSAGE);
    await mail.settled();

    expect(await inbox.next()).toEqual(MESSAGE);
    expect(jobsIn(db)).toEqual([{
      kind: SEND_EMAIL_JOB, payload: JSON.stringify(MESSAGE), attempts: 1, maxAttempts: EMAIL_MAX_ATTEMPTS, runAt: Date.now(), lastError: null, doneAt: Date.now(), failedAt: null,
    }]);
  });

  it('retries a failed send after 2, then 4 minutes, and delivers it once', async () => {
    const mail = createMailQueue(queue, transport(2));
    await expect(mail.sender.send(MESSAGE)).resolves.toBeUndefined();
    await mail.settled();
    expect(jobsIn(db)).toMatchObject([{ attempts: 1, runAt: Date.now() + EMAIL_RETRY_BASE_MS, lastError: 'smtp down 1', doneAt: null }]);
    expect(inbox.size).toBe(0);

    advance(EMAIL_RETRY_BASE_MS - 1);
    expect(await mail.runner.runDue()).toBe(0);
    advance(1);
    expect(await mail.runner.runDue()).toBe(1);
    expect(jobsIn(db)).toMatchObject([{ attempts: 2, runAt: Date.now() + 2 * EMAIL_RETRY_BASE_MS, lastError: 'smtp down 2', doneAt: null }]);

    advance(2 * EMAIL_RETRY_BASE_MS);
    expect(await mail.runner.runDue()).toBe(1);
    expect(jobsIn(db)).toMatchObject([{ attempts: 3, doneAt: Date.now(), failedAt: null }]);
    expect(await inbox.next()).toEqual(MESSAGE);
    expect(inbox.size).toBe(0);
    expect(calls).toBe(3);
  });

  it('gives up after six attempts', async () => {
    const mail = createMailQueue(queue, transport(Infinity));
    await mail.sender.send(MESSAGE);
    await mail.settled();
    for (let attempt = 2; attempt <= EMAIL_MAX_ATTEMPTS; attempt++) {
      advance(60 * 60_000);
      expect(await mail.runner.runDue()).toBe(1);
    }
    expect(jobsIn(db)).toMatchObject([{ attempts: 6, failedAt: Date.now(), lastError: 'smtp down 6' }]);
    advance(DAY_MS);
    expect(await mail.runner.runDue()).toBe(0);
    expect(calls).toBe(6);
  });

  it('returns before the transport answers', async () => {
    const mail = createMailQueue(queue, { send: () => new Promise<void>(() => void calls++) });
    await mail.sender.send(MESSAGE);
    expect(jobsIn(db)).toHaveLength(1);
    await tick();
    expect(calls).toBe(1);
  });
});

describe('mail from Better Auth', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await startApp();
  });

  afterEach(() => t.close());

  const mailTo = (address: string) =>
    jobsIn(t.db).filter(row => row.kind === SEND_EMAIL_JOB && JSON.parse(row.payload).to.toLowerCase() === address).map(row => (row.doneAt ? 'sent' : 'pending'));

  it('goes through the queue', async () => {
    await t.signUpVerified();
    expect(mailTo(USER.email)).toEqual(['sent']);
    expect(jobsIn(t.db)).toMatchObject([{ kind: SEND_EMAIL_JOB, maxAttempts: EMAIL_MAX_ATTEMPTS, payload: expect.stringContaining('/api/auth/verify-email?token=') }]);
  });

  it('is removed with the account it was for, queued or sent, and no one else’s', async () => {
    const ada = await t.signUpVerified();
    await t.signUpVerified(new Jar(), BO);
    const later = { runAt: Date.now() + DAY_MS };
    t.jobs.queue.enqueue(SEND_EMAIL_JOB, { ...MESSAGE, to: USER.email }, later);
    t.jobs.queue.enqueue(SEND_EMAIL_JOB, { ...MESSAGE, to: USER.email.toUpperCase() }, later);
    t.jobs.queue.enqueue(SEND_EMAIL_JOB, { ...MESSAGE, to: BO.email }, later);

    expect((await t.post('/api/auth/delete-user', { callbackURL: '/?account=deleted' }, { cookie: ada.get() })).status).toBe(200);
    const link = linkIn(await t.inbox.next());
    expect(mailTo(USER.email)).toHaveLength(4);
    expect((await t.app.request(link, { headers: { cookie: ada.get() } })).status).toBe(302);

    expect(t.db.prepare('SELECT count(*) FROM auth_user WHERE email = ?').pluck().get(USER.email)).toBe(0);
    expect(mailTo(USER.email)).toEqual([]);
    expect(mailTo(BO.email)).toEqual(['sent', 'pending']);
  });
});
