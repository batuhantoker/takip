import { expect, vi } from 'vitest';
import { createAccess } from '../access/resolver';
import { createUsage } from '../access/usage';
import { createApp, type AppObs } from '../app';
import { createAuth } from '../auth/auth';
import type { BillingProvider } from '../billing/provider';
import { billingJobs } from '../billing/reconcile';
import { openAppDb } from '../db/app-db';
import { migrateAppSchema } from '../db/migrations';
import { createJobQueue } from '../jobs/queue';
import { createJobRunner } from '../jobs/runner';
import type { EmailMessage, EmailSender } from '../mail/sender';
import type { ReplayData } from '../replay/data';
import type { SocialEnv } from '../auth/social-providers';

export { totp } from './totp';

export const ORIGIN = 'http://localhost:3000';
// The web app's landing URLs (src/lib/account-links.ts).
export const VERIFIED = '/?account=verified';
export const RESET = '/?account=reset-password';
export const SIGN_IN_FAILED = '/?account=sign-in-failed';
export const USER = { name: 'Ada', email: 'ada@example.com', password: 'correct horse battery' };
export const GOOGLE = { GOOGLE_CLIENT_ID: 'google-id', GOOGLE_CLIENT_SECRET: 'google-secret' };

/** Collects mail; `next()` waits for the next message, since Better Auth sends after responding. */
export class Inbox implements EmailSender {
  private queued: EmailMessage[] = [];
  private waiting: ((m: EmailMessage) => void)[] = [];

  async send(message: EmailMessage) {
    const waiter = this.waiting.shift();
    if (waiter) waiter(message);
    else this.queued.push(message);
  }

  next() {
    const message = this.queued.shift();
    return message ? Promise.resolve(message) : new Promise<EmailMessage>(resolve => this.waiting.push(resolve));
  }

  get size() {
    return this.queued.length;
  }
}

/** Holds cookies the way a browser would, including deletions. */
export class Jar {
  private cookies = new Map<string, string>();

  take(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const name = pair.slice(0, pair.indexOf('='));
      if (/max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, pair);
    }
    return res;
  }

  get(name?: string) {
    return [...this.cookies].filter(([n]) => !name || n === name).map(([, pair]) => pair).join('; ');
  }
}

export const linkIn = (message: EmailMessage) => message.text.match(/https?:\/\/\S+/)![0];
export const consentUrl = async (res: Response) => new URL(((await res.json()) as { url: string }).url);
export const landing = (res: Response) => new URL(res.headers.get('location')!, ORIGIN);
export const tick = () => new Promise(resolve => setTimeout(resolve, 0));

export type TestApp = Awaited<ReturnType<typeof startApp>>;

// Limits are off unless a test is about them: most tests send many requests from one in-memory client.
// The job runner is built but never started: tests call jobs.runner.runDue() themselves.
export async function startApp(social: SocialEnv = {}, obs?: AppObs, { enforceLimits = false, billing = null, replay }: { enforceLimits?: boolean; billing?: BillingProvider | null; replay?: ReplayData } = {}) {
  const db = openAppDb(':memory:');
  migrateAppSchema(db);
  const inbox = new Inbox();
  const auth = await createAuth(db, { BETTER_AUTH_URL: ORIGIN, BETTER_AUTH_SECRET: 'q3Yp8vVx1kR7tLm2Zc9Wd4Hs6Nb0Fg5J', ...social }, inbox);
  const access = createAccess(db);
  const usage = createUsage(db);
  const app = createApp({ auth, access, db, obs, usage, enforceLimits, billing, replay });
  const queue = createJobQueue(db);
  const jobs = { queue, runner: createJobRunner(queue, billingJobs({ db, access, provider: billing, queue })) };

  const post = (path: string, body: unknown, { cookie = '', origin = ORIGIN } = {}) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, ...(cookie && { cookie }) },
      body: JSON.stringify(body),
    });

  const session = async (cookie: string) => {
    const res = await app.request('/api/auth/get-session', { headers: { cookie } });
    expect(res.status).toBe(200);
    return res.json() as Promise<{ user: { id: string; name: string; email: string; emailVerified: boolean } } | null>;
  };

  const signUpVerified = async (jar = new Jar(), user = USER) => {
    expect((await post('/api/auth/sign-up/email', { ...user, callbackURL: VERIFIED })).status).toBe(200);
    const verify = jar.take(await app.request(linkIn(await inbox.next())));
    expect(verify.status).toBe(302);
    expect(landing(verify).search).toBe('?account=verified');
    return jar;
  };

  return { db, inbox, auth, app, access, usage, jobs, post, session, signUpVerified, close: () => db.close() };
}

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsignedJwt = (claims: object) => `${base64url({ alg: 'none' })}.${base64url(claims)}.sig`;

/** Answers Google's token endpoint as if the user approved, with these id-token claims. Undo with vi.restoreAllMocks(). */
export function googleApproves(claims: { email: string; email_verified: boolean }) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith('https://oauth2.googleapis.com/token')) throw new Error(`unexpected fetch: ${url}`);
    return Response.json({
      access_token: 'access',
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: unsignedJwt({ iss: 'https://accounts.google.com', aud: 'google-id', sub: 'google-user-1', name: 'Ada G', ...claims }),
    });
  });
}

/** Starts a Google flow (sign-in or link) and follows Google's redirect back to our callback. */
export async function viaGoogle(t: TestApp, jar: Jar, path: '/api/auth/sign-in/social' | '/api/auth/link-social', body: object) {
  const start = jar.take(await t.post(path, { provider: 'google', ...body }, { cookie: jar.get() }));
  expect(start.status).toBe(200);
  const consent = await consentUrl(start);
  const back = jar.take(await t.app.request(
    `/api/auth/callback/google?code=c0de&state=${consent.searchParams.get('state')}`,
    { headers: { cookie: jar.get() } },
  ));
  expect(back.status).toBe(302);
  return { consent, landed: landing(back) };
}
