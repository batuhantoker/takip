import type { AccessResolver } from '../access/resolver';
import type { AppDb } from '../db/app-db';

/* Read models for the console. Better Auth stores dates as ISO text and booleans as 0/1. */

type RawUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: number;
  role: string | null;
  banned: number | null;
  banReason: string | null;
  banExpires: string | null;
  twoFactorEnabled: number | null;
  createdAt: string;
};

const USER_COLUMNS = 'id, name, email, emailVerified, role, banned, banReason, banExpires, twoFactorEnabled, createdAt';

const toUser = (row: RawUser) => ({
  ...row,
  emailVerified: row.emailVerified === 1,
  banned: row.banned === 1,
  twoFactorEnabled: row.twoFactorEnabled === 1,
});

export function adminQueries(db: AppDb, access: AccessResolver) {
  const planOf = (id: string) => access.resolve({ type: 'user', id }).plan.id;

  return {
    users({ q, offset, limit }: { q: string; offset: number; limit: number }) {
      const like = `%${q.trim()}%`;
      const where = q.trim() ? 'WHERE email LIKE ? OR name LIKE ?' : '';
      const params = q.trim() ? [like, like] : [];
      const total = db.prepare(`SELECT count(*) FROM auth_user ${where}`).pluck().get(...params) as number;
      const rows = db.prepare(`SELECT ${USER_COLUMNS} FROM auth_user ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as RawUser[];
      return { total, users: rows.map(row => ({ ...toUser(row), plan: planOf(row.id) })) };
    },

    user(id: string) {
      const row = db.prepare(`SELECT ${USER_COLUMNS} FROM auth_user WHERE id = ?`).get(id) as RawUser | undefined;
      if (!row) return null;
      return {
        user: toUser(row),
        access: access.resolve({ type: 'user', id }),
        accounts: db.prepare('SELECT providerId, createdAt FROM auth_account WHERE userId = ? ORDER BY createdAt').all(id),
        sessions: db.prepare(`
          SELECT id, userAgent, ipAddress, createdAt, updatedAt, expiresAt, impersonatedBy FROM auth_session
          WHERE userId = ? AND expiresAt > ? ORDER BY updatedAt DESC`).all(id, new Date().toISOString()),
        overrides: db.prepare(`
          SELECT key, value, expires_at AS expiresAt, granted_by AS grantedBy, reason FROM bill_subject_override
          WHERE subject_type = 'user' AND subject_id = ? ORDER BY key`).all(id),
        subscriptions: db.prepare(`
          SELECT provider, plan_id AS planId, status, current_period_end AS periodEnd, grace_until AS graceUntil, updated_at AS updatedAt
          FROM bill_subscription WHERE subject_type = 'user' AND subject_id = ? ORDER BY updated_at DESC`).all(id),
      };
    },

    overview() {
      const count = (sql: string, ...params: unknown[]) => db.prepare(sql).pluck().get(...params) as number;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const subscribed = db.prepare(`
        SELECT DISTINCT subject_id FROM bill_subscription
        WHERE subject_type = 'user' AND status IN ('active', 'trialing', 'past_due')`).pluck().all() as string[];
      const byPlan: Record<string, number> = {};
      for (const id of subscribed) {
        const plan = planOf(id);
        if (plan !== 'free') byPlan[plan] = (byPlan[plan] ?? 0) + 1;
      }
      return {
        users: count('SELECT count(*) FROM auth_user'),
        newThisWeek: count('SELECT count(*) FROM auth_user WHERE createdAt > ?', weekAgo),
        unverified: count('SELECT count(*) FROM auth_user WHERE emailVerified = 0'),
        admins: count("SELECT count(*) FROM auth_user WHERE role = 'admin'"),
        banned: count('SELECT count(*) FROM auth_user WHERE banned = 1'),
        signedInNow: count('SELECT count(DISTINCT userId) FROM auth_session WHERE expiresAt > ?', new Date().toISOString()),
        onPaidOrGrantedPlans: byPlan,
      };
    },

    /** Newest first; `before` is the last audit_id of the previous page. */
    audit({ action, subject, before, limit }: { action?: string; subject?: string; before?: number; limit: number }) {
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (action) { clauses.push('a.action LIKE ?'); params.push(`${action}%`); }
      if (subject) { clauses.push('a.subject_id = ?'); params.push(subject); }
      if (before) { clauses.push('a.audit_id < ?'); params.push(before); }
      return db.prepare(`
        SELECT a.audit_id AS id, a.at, a.actor_type AS actorType, a.actor_id AS actorId, actor.email AS actorEmail,
               a.impersonator, impersonator.email AS impersonatorEmail,
               a.action, a.subject_id AS subjectId, subject.email AS subjectEmail, a.data
        FROM audit_event a
        LEFT JOIN auth_user actor ON actor.id = a.actor_id
        LEFT JOIN auth_user impersonator ON impersonator.id = a.impersonator
        LEFT JOIN auth_user subject ON subject.id = a.subject_id
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY a.audit_id DESC LIMIT ?`).all(...params, limit)
        .map(row => ({ ...(row as Record<string, unknown>), data: JSON.parse((row as { data: string }).data) }));
    },
  };
}
