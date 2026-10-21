import type { AppDb } from '../db/app-db';
import type { Presence } from './presence';

/**
 * GET /api/admin/analytics/live: who is on the map or a public page now (presence.ts), with the account and visitor
 * record behind each when there is one. Admins are marked, and left out when `excludeAdmins`.
 */
export function live(db: AppDb, presence: Presence, { excludeAdmins }: { excludeAdmins: boolean }) {
  const entries = presence.list();
  const visitorIds = entries.flatMap(e => (e.visitorId ? [e.visitorId] : []));
  const linked = new Map(
    visitorIds.length
      ? (db.prepare(`SELECT visitor_id AS id, user_id AS userId FROM visitor WHERE visitor_id IN (${visitorIds.map(() => '?').join(',')})`)
          .all(...visitorIds) as { id: string; userId: string | null }[]).map(v => [v.id, v.userId])
      : [],
  );
  const userIds = [...new Set(entries.map(e => e.userId ?? (e.visitorId ? linked.get(e.visitorId) : null)).filter((id): id is string => !!id))];
  const users = new Map(
    userIds.length
      ? (db.prepare(`SELECT id, email, name, role FROM auth_user WHERE id IN (${userIds.map(() => '?').join(',')})`)
          .all(...userIds) as { id: string; email: string; name: string; role: string | null }[]).map(u => [u.id, u])
      : [],
  );

  const people = entries.flatMap(e => {
    const userId = e.userId ?? (e.visitorId ? linked.get(e.visitorId) : null) ?? null;
    const user = userId ? users.get(userId) ?? null : null;
    const admin = user?.role === 'admin';
    if (admin && excludeAdmins) return [];
    return [{
      key: e.key, kind: e.kind, path: e.path, features: e.features, actions: e.actions, referrer: e.referrer, place: e.place, agent: e.agent, since: e.since, at: e.at,
      visitorId: e.visitorId,
      known: !!e.visitorId && linked.has(e.visitorId),
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      admin,
    }];
  });
  return { people };
}
