import type { Access } from '@takip/core/entitlements';
import { isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { keyStore } from '../keys/store';

/** Bumped when a field changes meaning or goes away; added fields keep the number. */
export const EXPORT_FORMAT = 1;

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

type Json = Record<string, unknown>;

/**
 * Everything app.db holds about one user (backend.md §12.3). Columns are named one by one: tokens, password
 * hashes, 2FA secrets, backup codes and key hashes are never selected. Better Auth's dates are ISO text already.
 */
export function accountExport(db: AppDb, userId: string, { access, currentSessionId, now = Date.now() }: {
  access: Access; currentSessionId: string; now?: number;
}) {
  const all = (sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as Json[];

  const user = db.prepare(`
    SELECT id, name, email, emailVerified, image, role, banned, banReason, banExpires, twoFactorEnabled, createdAt, updatedAt
    FROM auth_user WHERE id = ?`).get(userId) as Json & { emailVerified: number; banned: number | null; twoFactorEnabled: number | null } | undefined;
  if (!user) return null;
  const { twoFactorEnabled, ...profile } = user;

  return {
    format: EXPORT_FORMAT,
    exportedAt: iso(now),
    profile: { ...profile, emailVerified: user.emailVerified === 1, banned: user.banned === 1 },
    signInMethods: all(`
      SELECT providerId AS provider, accountId, scope, createdAt, updatedAt
      FROM auth_account WHERE userId = ? ORDER BY createdAt`, userId),
    sessions: all(`
      SELECT id, createdAt, updatedAt AS lastActiveAt, expiresAt, ipAddress, userAgent
      FROM auth_session WHERE userId = ? ORDER BY updatedAt DESC`, userId)
      .map(({ id, ...session }) => ({ ...session, current: id === currentSessionId })),
    twoFactor: { enabled: twoFactorEnabled === 1 },
    plan: { id: access.plan.id, name: access.plan.name, subscription: access.subscription, entitlements: access.entitlements },
    subscriptions: all(`
      SELECT provider, provider_sub_id AS providerSubscriptionId, plan_id AS plan, status, current_period_end AS currentPeriodEnd,
             cancel_at AS cancelAt, grace_until AS graceUntil, created_at AS createdAt, updated_at AS updatedAt
      FROM bill_subscription WHERE subject_type = 'user' AND subject_id = ? ORDER BY created_at`, userId)
      .map(row => times(row, 'currentPeriodEnd', 'cancelAt', 'graceUntil', 'createdAt', 'updatedAt')),
    overrides: all(`
      SELECT key, value, expires_at AS expiresAt, reason FROM bill_subject_override
      WHERE subject_type = 'user' AND subject_id = ? ORDER BY key`, userId)
      .map(row => times(row, 'expiresAt')),
    billingCustomers: all(`
      SELECT provider, customer_id AS customerId, created_at AS createdAt FROM bill_customer
      WHERE subject_type = 'user' AND subject_id = ? ORDER BY created_at`, userId)
      .map(row => times(row, 'createdAt')),
    apiKeys: keyStore(db).list(userId, { revoked: true })
      .map(key => ({ ...key, createdAt: iso(key.createdAt), expiresAt: iso(key.expiresAt), lastUsedAt: iso(key.lastUsedAt), revokedAt: iso(key.revokedAt) })),
    usage: all(`
      SELECT day, key_id AS apiKeyId, route_group AS routeGroup, requests, bytes, denied FROM usage_counter
      WHERE subject_type = 'user' AND subject_id = ? ORDER BY day, key_id, route_group`, userId)
      .map((row): Json => ({ ...row, day: isoDay(row.day as number), apiKeyId: row.apiKeyId || null })),
    audit: all(`
      SELECT at, actor_type AS actorType, actor_id AS actorId, action, subject_type AS subjectType, subject_id AS subjectId, data
      FROM audit_event WHERE (subject_type = 'user' AND subject_id = ?) OR actor_id = ? ORDER BY audit_id`, userId, userId)
      .map((row): Json => ({ ...times(row, 'at'), data: JSON.parse(row.data as string) as unknown })),
    adminUnlocks: all('SELECT unlocked_at AS unlockedAt FROM admin_unlock WHERE user_id = ? ORDER BY unlocked_at', userId)
      .map(row => times(row, 'unlockedAt')),
    // Deleted ones too: they stay in app.db until the account goes.
    workspaces: all(`
      SELECT workspace_id AS id, name, state, state_version AS stateVersion, rev, visibility, share_slug AS shareSlug,
             created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt
      FROM ws_workspace WHERE owner_id = ? ORDER BY created_at, workspace_id`, userId)
      .map((row): Json => ({ ...times(row, 'createdAt', 'updatedAt', 'deletedAt'), state: JSON.parse(row.state as string) as unknown })),
  };
}

function times(row: Json, ...fields: string[]): Json {
  const out = { ...row };
  for (const field of fields) out[field] = iso(row[field] as number | null);
  return out;
}

export type AccountExport = NonNullable<ReturnType<typeof accountExport>>;
