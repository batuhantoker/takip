import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { CATALOGUE } from '@takip/core/entitlements';
import { clearOverride, grantPlan, revokePlan, setOverride, setPlanValue, type Actor } from '../access/grants';
import type { AccessResolver } from '../access/resolver';
import type { Auth } from '../auth/auth';
import type { AppDb } from '../db/app-db';
import type { ApiKeys } from '../keys/api-keys';
import { adminKeyRoutes } from '../keys/admin-routes';
import type { AdminEnv, AdminGate } from './gate';
import { impersonation } from './impersonation';
import { adminQueries } from './queries';
import type { SourceSwitchboard } from '../replay/sources';
import { sourcesRoutes } from './sources-routes';

/** "YYYY-MM-DD" → the end of that day (UTC), or null. */
const endOfDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform(day => Date.parse(`${day}T23:59:59Z`)).nullish();
const reason = z.string().trim().max(500).optional();

const bodies = {
  unlock: z.object({ code: z.string().trim().min(6).max(32) }),
  grant: z.object({ planId: z.string(), until: endOfDay, reason }),
  revoke: z.object({ reason }),
  override: z.object({ value: z.string(), until: endOfDay, reason }),
  ban: z.object({ reason: z.string().trim().min(1).max(500), until: endOfDay }),
  planValue: z.object({ value: z.string() }),
};

async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T> | Response> {
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  return parsed.success ? parsed.data : c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
}

/** Runs an operator change; grants.ts throws plain Errors for bad plans, keys and values. */
function change(c: Context, run: () => void, access: AccessResolver) {
  try {
    run();
  } catch (error) {
    return c.json({ error: 'invalid_change', message: error instanceof Error ? error.message : String(error) }, 400);
  }
  access.invalidate();
  return c.json({ ok: true });
}

/** Mounted at /api/admin. Everything but status, unlock and stopping an impersonation sits behind the gate. */
export function adminRoutes({ auth, db, access, gate, switchboard, keys }: { auth: Auth; db: AppDb; access: AccessResolver; gate: AdminGate; switchboard?: SourceSwitchboard; keys: ApiKeys }) {
  const app = new Hono<AdminEnv>();
  const queries = adminQueries(db, access);
  const actor = (c: Context<AdminEnv>): Actor => ({ type: 'admin', id: c.var.admin.userId });
  const audit = (c: Context<AdminEnv>, action: string, subjectId: string, data: object) =>
    db.prepare(`
      INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
      VALUES (?, 'admin', ?, ?, 'user', ?, ?)`).run(Date.now(), c.var.admin.userId, action, subjectId, JSON.stringify(data));
  const exists = (id: string) => Boolean(db.prepare('SELECT 1 FROM auth_user WHERE id = ?').get(id));
  const viewAs = impersonation({ auth, db });

  app.get('/status', async c => c.json(await gate.status(c.req.raw.headers), 200, { 'Cache-Control': 'no-store' }));

  app.post('/unlock', async c => {
    const parsed = await body(c, bodies.unlock);
    if (parsed instanceof Response) return parsed;
    const result = await gate.unlock(c.req.raw.headers, parsed.code);
    return c.json(result.body, result.status);
  });

  app.post('/impersonation/stop', viewAs.stop);

  app.use('*', gate.requireAdmin);
  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });
  if (switchboard) app.route('/sources', sourcesRoutes({ db, switchboard }));
  app.route('/users', adminKeyRoutes(keys));

  app.get('/overview', c => c.json({ ...queries.overview(), recent: queries.audit({ limit: 10 }) }));

  app.get('/users', c => {
    const q = c.req.query('q') ?? '';
    const offset = Math.max(0, Number(c.req.query('offset')) || 0);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 50));
    return c.json(queries.users({ q, offset, limit }));
  });

  app.get('/users/:id', c => {
    const detail = queries.user(c.req.param('id'));
    if (!detail) return c.json({ error: 'not_found' }, 404);
    return c.json({ ...detail, audit: queries.audit({ subject: c.req.param('id'), limit: 50 }) });
  });

  app.put('/users/:id/plan', async c => {
    const parsed = await body(c, bodies.grant);
    if (parsed instanceof Response) return parsed;
    const userId = c.req.param('id');
    if (!exists(userId)) return c.json({ error: 'not_found' }, 404);
    return change(c, () => grantPlan(db, { userId, planId: parsed.planId, until: parsed.until, actor: actor(c), reason: parsed.reason }), access);
  });

  app.delete('/users/:id/plan', async c => {
    const parsed = await body(c, bodies.revoke);
    if (parsed instanceof Response) return parsed;
    return change(c, () => revokePlan(db, { userId: c.req.param('id'), actor: actor(c), reason: parsed.reason }), access);
  });

  app.put('/users/:id/overrides/:key', async c => {
    const parsed = await body(c, bodies.override);
    if (parsed instanceof Response) return parsed;
    const userId = c.req.param('id');
    if (!exists(userId)) return c.json({ error: 'not_found' }, 404);
    return change(c, () => setOverride(db, { userId, key: c.req.param('key'), value: parsed.value, until: parsed.until, actor: actor(c), reason: parsed.reason }), access);
  });

  app.delete('/users/:id/overrides/:key', c =>
    change(c, () => clearOverride(db, { userId: c.req.param('id'), key: c.req.param('key'), actor: actor(c) }), access));

  app.post('/users/:id/ban', async c => {
    const parsed = await body(c, bodies.ban);
    if (parsed instanceof Response) return parsed;
    const userId = c.req.param('id');
    if (userId === c.var.admin.userId) return c.json({ error: 'cannot_ban_self' }, 400);
    if (!exists(userId)) return c.json({ error: 'not_found' }, 404);
    const banExpiresIn = parsed.until ? Math.max(1, Math.round((parsed.until - Date.now()) / 1000)) : undefined;
    // Bans also end every session the user has.
    await auth.api.banUser({ headers: c.req.raw.headers, body: { userId, banReason: parsed.reason, banExpiresIn } });
    keys.forgetUser(userId);
    audit(c, 'user.ban', userId, { reason: parsed.reason, until: parsed.until ?? null });
    return c.json({ ok: true });
  });

  app.post('/users/:id/unban', async c => {
    const userId = c.req.param('id');
    if (!exists(userId)) return c.json({ error: 'not_found' }, 404);
    await auth.api.unbanUser({ headers: c.req.raw.headers, body: { userId } });
    keys.forgetUser(userId);
    audit(c, 'user.unban', userId, {});
    return c.json({ ok: true });
  });

  app.post('/users/:id/impersonate', viewAs.start);

  app.post('/users/:id/sign-out', async c => {
    const userId = c.req.param('id');
    if (!exists(userId)) return c.json({ error: 'not_found' }, 404);
    await auth.api.revokeUserSessions({ headers: c.req.raw.headers, body: { userId } });
    audit(c, 'user.sign_out_everywhere', userId, {});
    return c.json({ ok: true });
  });

  app.get('/plans', c => {
    const plans = db.prepare('SELECT plan_id AS id, name, public, sort, archived_at AS archivedAt FROM bill_plan ORDER BY sort').all() as { id: string }[];
    const values = db.prepare('SELECT plan_id AS planId, key, value FROM bill_plan_entitlement').all() as { planId: string; key: string; value: string }[];
    return c.json({
      catalogue: Object.entries(CATALOGUE).map(([key, spec]) => ({ key, ...spec })),
      plans: plans.map(plan => ({
        ...plan,
        values: Object.fromEntries(values.filter(v => v.planId === plan.id).map(v => [v.key, v.value])),
      })),
    });
  });

  app.put('/plans/:planId/entitlements/:key', async c => {
    const parsed = await body(c, bodies.planValue);
    if (parsed instanceof Response) return parsed;
    return change(c, () => setPlanValue(db, { planId: c.req.param('planId'), key: c.req.param('key'), value: parsed.value, actor: actor(c) }), access);
  });

  app.get('/audit', c => {
    const before = Number(c.req.query('before')) || undefined;
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit')) || 50));
    return c.json({ events: queries.audit({ action: c.req.query('action') || undefined, subject: c.req.query('subject') || undefined, before, limit }) });
  });

  return app;
}
