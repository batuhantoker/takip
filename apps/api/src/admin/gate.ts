import { createMiddleware } from 'hono/factory';
import type { Auth } from '../auth/auth';
import type { AppDb } from '../db/app-db';

/*
 * The admin console needs the admin role, 2FA turned on, and a 2FA code entered on this session
 * within the last 12 hours. The step-up matters because Better Auth's 2FA only guards password
 * sign-in: a session from Google or GitHub never saw a code.
 */
export const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export type AdminUser = { userId: string; email: string; sessionId: string };
export type AdminEnv = { Variables: { admin: AdminUser } };

export type GateStatus = { signedIn: boolean; admin: boolean; twoFactor: boolean; unlockedUntil: number | null };

type Refusal = { status: 400 | 401 | 403 | 429; body: { error: string; retryAfterSeconds?: number } };

export function createAdminGate(auth: Auth, db: AppDb, now = () => Date.now()) {
  const unlockRow = db.prepare('SELECT unlocked_at FROM admin_unlock WHERE session_id = ? AND unlocked_at > ?').pluck();
  const saveUnlock = db.prepare(`
    INSERT INTO admin_unlock (session_id, user_id, unlocked_at) VALUES (?, ?, ?)
    ON CONFLICT (session_id) DO UPDATE SET unlocked_at = excluded.unlocked_at`);
  const dropExpired = db.prepare('DELETE FROM admin_unlock WHERE unlocked_at <= ?');
  const audit = db.prepare(`
    INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
    VALUES (?, 'admin', ?, ?, 'user', ?, '{}')`);
  // Per user, because the threat is a stolen session, not one address. Resets when the api restarts.
  const failures = new Map<string, number[]>();

  // Straight from the database: a demotion or a ban must apply at once, not after the 5-minute cookie cache.
  const sessionOf = (headers: Headers) => auth.api.getSession({ headers, query: { disableCookieCache: true } });

  function unlockedUntil(sessionId: string) {
    const at = unlockRow.get(sessionId, now() - UNLOCK_TTL_MS) as number | undefined;
    return at === undefined ? null : at + UNLOCK_TTL_MS;
  }

  function refuse(session: Awaited<ReturnType<typeof sessionOf>>): Refusal | null {
    if (!session) return { status: 401, body: { error: 'sign_in_required' } };
    if (session.user.role !== 'admin') return { status: 403, body: { error: 'admin_only' } };
    if (!session.user.twoFactorEnabled) return { status: 403, body: { error: 'two_factor_required' } };
    return null;
  }

  return {
    async status(headers: Headers): Promise<GateStatus> {
      const session = await sessionOf(headers);
      return {
        signedIn: Boolean(session),
        admin: session?.user.role === 'admin',
        twoFactor: Boolean(session?.user.twoFactorEnabled),
        unlockedUntil: session && session.user.role === 'admin' ? unlockedUntil(session.session.id) : null,
      };
    },

    /** Checks a 2FA or backup code for this session; on success the console stays open for 12 hours. */
    async unlock(headers: Headers, code: string): Promise<Refusal | { status: 200; body: { unlockedUntil: number } }> {
      const session = await sessionOf(headers);
      const refusal = refuse(session);
      if (refusal || !session) return refusal!;

      const userId = session.user.id;
      const recent = (failures.get(userId) ?? []).filter(at => at > now() - FAILURE_WINDOW_MS);
      if (recent.length >= MAX_FAILURES) {
        return { status: 429, body: { error: 'too_many_attempts', retryAfterSeconds: Math.ceil((recent[0] + FAILURE_WINDOW_MS - now()) / 1000) } };
      }

      try {
        // Better Auth applies no lockout to these on an existing session, hence the count above.
        if (/^\d{6}$/.test(code)) await auth.api.verifyTOTP({ headers, body: { code } });
        else await auth.api.verifyBackupCode({ headers, body: { code } });
      } catch {
        failures.set(userId, [...recent, now()]);
        return { status: 401, body: { error: 'invalid_code' } };
      }

      failures.delete(userId);
      dropExpired.run(now() - UNLOCK_TTL_MS);
      saveUnlock.run(session.session.id, userId, now());
      audit.run(now(), userId, 'admin.unlock', userId);
      return { status: 200, body: { unlockedUntil: now() + UNLOCK_TTL_MS } };
    },

    requireAdmin: createMiddleware<AdminEnv>(async (c, next) => {
      const session = await sessionOf(c.req.raw.headers);
      const refusal = refuse(session);
      if (refusal) return c.json(refusal.body, refusal.status);
      if (!unlockedUntil(session!.session.id)) return c.json({ error: 'unlock_required' }, 403);
      c.set('admin', { userId: session!.user.id, email: session!.user.email, sessionId: session!.session.id });
      await next();
    }),
  };
}

export type AdminGate = ReturnType<typeof createAdminGate>;
