import { isIP } from 'node:net';
import type { AppDb } from '../db/app-db';

/**
 * Every table holding rows that belong to one user (backend.md §12.3). A new table with user data gets a line
 * here. Better Auth removes the user's sessions and accounts itself and auth_two_factor follows by foreign key;
 * they are listed so a database without that cascade loses them too.
 */
const OWNED: readonly { table: string; where: string }[] = [
  { table: 'api_key', where: 'user_id = @id' },
  { table: 'admin_unlock', where: 'user_id = @id' },
  { table: 'bill_subject_override', where: "subject_type = 'user' AND subject_id = @id" },
  { table: 'bill_subscription', where: "subject_type = 'user' AND subject_id = @id" },
  { table: 'bill_customer', where: "subject_type = 'user' AND subject_id = @id" },
  { table: 'auth_two_factor', where: 'userId = @id' },
  { table: 'auth_account', where: 'userId = @id' },
  { table: 'auth_session', where: 'userId = @id OR impersonatedBy = @id' },
  // Reset, deletion, 2FA and trust-device rows hold the user id; a pending provider connection holds it in JSON.
  { table: 'auth_verification', where: "value = @id OR (json_valid(value) AND json_extract(value, '$.link.userId') = @id)" },
];

export type EraseActor = { type: 'user' | 'admin' | 'system'; id: string | null };

/** The user themselves, an admin acting on them, or a server-side call with no session. */
export function deletedBy(userId: string, sessionUserId: string | undefined): EraseActor {
  if (!sessionUserId) return { type: 'system', id: null };
  return { type: sessionUserId === userId ? 'user' : 'admin', id: sessionUserId };
}

const REMOVED = '[removed]';
const EMAIL = /[^\s@"'<>(),;:[\]]+@[^\s@"'<>(),;:[\]]+\.[a-z]{2,}/gi;
const IP_KEY = /^(ips?|ip_?address(es)?|ip_?hash|client_?ip|remote_?address|x_?forwarded_?for|user_?agent)$/i;

/** Email addresses and IP addresses out of an audit payload, at any depth. */
export function scrub(value: unknown): unknown {
  if (typeof value === 'string') return isIP(value) ? REMOVED : value.replace(EMAIL, REMOVED);
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !IP_KEY.test(key)).map(([key, v]) => [key, scrub(v)]));
  }
  return value;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Removes what belongs to a user and pseudonymises what stays: audit rows keep their subject and actor ids but
 * lose email and IP addresses, and usage_counter never held either. Runs in one transaction, before Better Auth
 * deletes the auth_user row, so a failure here stops the deletion instead of leaving data behind.
 */
export function eraseUser(db: AppDb, user: { id: string; email: string }, actor: EraseActor, now = Date.now()) {
  const email = user.email.toLowerCase();
  const audited = db.prepare(`
    SELECT audit_id AS id, data FROM audit_event
    WHERE (subject_type = 'user' AND subject_id = @id) OR actor_id = @id OR impersonator = @id OR instr(lower(data), @email) > 0`);
  const rewriteAudit = db.prepare('UPDATE audit_event SET data = ?, ip_hash = NULL WHERE audit_id = ?');
  const billEvents = db.prepare('SELECT provider, event_id AS eventId, payload FROM bill_event WHERE instr(lower(payload), @email) > 0');
  const rewriteBillEvent = db.prepare('UPDATE bill_event SET payload = ? WHERE provider = ? AND event_id = ?');
  const record = db.prepare(`
    INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
    VALUES (?, ?, ?, 'user.delete', 'user', ?, ?)`);
  const ownEmail = new RegExp(escapeRegExp(user.email), 'gi');

  return db.transaction(() => {
    const removed: Record<string, number> = {};
    for (const { table, where } of OWNED) {
      const { changes } = db.prepare(`DELETE FROM ${table} WHERE ${where}`).run({ id: user.id });
      if (changes) removed[table] = changes;
    }
    let pseudonymised = 0;
    for (const row of audited.all({ id: user.id, email }) as { id: number; data: string }[]) {
      rewriteAudit.run(JSON.stringify(scrub(JSON.parse(row.data))), row.id);
      pseudonymised++;
    }
    // Provider webhooks are kept for idempotency; the provider keeps the billing record itself.
    for (const row of billEvents.all({ email }) as { provider: string; eventId: string; payload: string }[]) {
      rewriteBillEvent.run(row.payload.replace(ownEmail, REMOVED), row.provider, row.eventId);
    }
    record.run(now, actor.type, actor.id, user.id, JSON.stringify({ removed, pseudonymised }));
    return { removed, pseudonymised };
  })();
}
