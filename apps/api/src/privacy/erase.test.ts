import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { landing } from '../testing/helpers';
import { scrub } from './erase';
import { BYSTANDER, startPrivacyApp, type PrivacyApp } from './testing';

let p: PrivacyApp;

beforeEach(async () => {
  p = await startPrivacyApp();
});

afterEach(() => {
  vi.restoreAllMocks();
  p.t.close();
});

// Each table that holds a user's rows, and the column naming them.
const OWNED = {
  auth_session: 'userId',
  auth_account: 'userId',
  auth_two_factor: 'userId',
  auth_verification: 'value',
  api_key: 'user_id',
  admin_unlock: 'user_id',
  bill_subject_override: 'subject_id',
  bill_subscription: 'subject_id',
  bill_customer: 'subject_id',
} as const;

const count = (sql: string, ...params: unknown[]) => p.t.db.prepare(sql).pluck().get(...params) as number;
const owned = (userId: string) =>
  Object.fromEntries(Object.entries(OWNED).map(([table, column]) => [table, count(`SELECT count(*) FROM ${table} WHERE ${column} = ?`, userId)]));
const usageRows = (userId: string) => count("SELECT count(*) FROM usage_counter WHERE subject_type = 'user' AND subject_id = ?", userId);
const auditOf = (userId: string) => p.t.db.prepare(`
  SELECT audit_id, actor_type, actor_id, action, subject_id, ip_hash, data FROM audit_event
  WHERE subject_id = ? OR actor_id = ? ORDER BY audit_id`).all(userId, userId) as { action: string; actor_type: string; actor_id: string; ip_hash: string | null; data: string }[];
const billEvents = () => p.t.db.prepare('SELECT event_id, payload FROM bill_event ORDER BY event_id').all() as { event_id: string; payload: string }[];

describe('account deletion', () => {
  it('removes every row tied to the user and pseudonymises the ones that stay', async () => {
    const ada = await p.withEverything();
    const bo = await p.withEverything(BYSTANDER, { google: false });
    const before = { ada: owned(ada.userId), bo: owned(bo.userId), boAudit: auditOf(bo.userId), adaUsage: usageRows(ada.userId), adaAudit: auditOf(ada.userId).length };
    for (const [table, rows] of Object.entries(before.ada)) expect(rows, table).toBeGreaterThan(0);
    expect(before.ada).toMatchObject({ auth_session: 2, auth_account: 2, api_key: 1, bill_subscription: 2, bill_customer: 1 });
    expect(before.adaUsage).toBeGreaterThan(0);

    const res = await p.deleteViaLink(ada.jar);
    expect(res.status).toBe(302);
    expect(`${landing(res).pathname}${landing(res).search}`).toBe('/?account=deleted');

    expect(count('SELECT count(*) FROM auth_user WHERE id = ?', ada.userId)).toBe(0);
    expect(owned(ada.userId)).toEqual(Object.fromEntries(Object.keys(OWNED).map(table => [table, 0])));
    expect(usageRows(ada.userId)).toBe(before.adaUsage);

    const audit = auditOf(ada.userId);
    expect(audit).toHaveLength(before.adaAudit + 1);
    for (const row of audit) {
      expect(row.data.toLowerCase()).not.toContain('ada@example.com');
      expect(row.ip_hash).toBeNull();
    }
    const data = (action: string) => JSON.parse(audit.find(row => row.action === action)!.data) as Record<string, unknown>;
    expect(data('test.sign_in')).toEqual({ from: '[removed]', note: 'signed in as [removed]' });
    expect(data('plan.grant')).toMatchObject({ plan: 'pro', reason: 'asked by [removed]' });
    expect(audit.at(-1)).toMatchObject({ action: 'user.delete', actor_type: 'user', actor_id: ada.userId });
    expect(data('user.delete')).toMatchObject({
      removed: { api_key: 1, admin_unlock: 1, bill_subject_override: 1, bill_subscription: 2, bill_customer: 1, auth_two_factor: 1 },
    });

    const events = billEvents();
    expect(events.find(e => e.event_id === `evt_${ada.userId}`)!.payload).not.toContain('ada@example.com');
    expect(events.find(e => e.event_id === `evt_${bo.userId}`)!.payload).toContain('bo@example.com');

    expect(owned(bo.userId)).toEqual(before.bo);
    expect(auditOf(bo.userId)).toEqual(before.boAudit);
  });

  it('runs when an admin removes the user through Better Auth', async () => {
    const ada = await p.withEverything();
    const bo = await p.withEverything(BYSTANDER, { google: false });

    await p.t.auth.api.removeUser({ headers: new Headers({ cookie: bo.jar.get() }), body: { userId: ada.userId } });

    expect(count('SELECT count(*) FROM auth_user WHERE id = ?', ada.userId)).toBe(0);
    expect(Object.values(owned(ada.userId)).every(rows => rows === 0)).toBe(true);
    expect(auditOf(ada.userId).at(-1)).toMatchObject({ action: 'user.delete', actor_type: 'admin', actor_id: bo.userId });
  });

  it('rolls the clean-up back and keeps the user row when it fails', async () => {
    const ada = await p.withEverything();
    p.t.db.exec('DROP TABLE admin_unlock');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await p.deleteViaLink(ada.jar)).status).toBe(500);
    expect(count('SELECT count(*) FROM auth_user WHERE id = ?', ada.userId)).toBe(1);
    expect(count('SELECT count(*) FROM api_key WHERE user_id = ?', ada.userId)).toBe(1);
    expect(count("SELECT count(*) FROM audit_event WHERE action = 'user.delete'")).toBe(0);
    // Better Auth removes sessions and sign-in methods before the user row; "Forgot password" restores a way in.
    expect(count('SELECT count(*) FROM auth_account WHERE userId = ?', ada.userId)).toBe(0);
  });
});

describe('scrub', () => {
  it('drops address and user-agent fields and masks email and IP addresses at any depth', () => {
    expect(scrub({
      ip: '10.0.0.1', ipAddress: 'x', user_agent: 'x', keyId: 'k1', peer: '2001:db8::1',
      reasons: ['ok', 'mail A.B@Example.org now'], nested: { client_ip: 'x', count: 3, flag: true, none: null },
    })).toEqual({ keyId: 'k1', peer: '[removed]', reasons: ['ok', 'mail [removed] now'], nested: { count: 3, flag: true, none: null } });
  });
});
