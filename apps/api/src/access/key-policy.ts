import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppDb } from '../db/app-db';
import type { AccessEnv } from './middleware';
import { routeGroup, type Usage } from './usage';

/**
 * Route groups (usage.ts `routeGroup`, and `replay`) an admin can open to callers without an API key
 * or close to them (Admin → API access). `keyRequired` is the default until an admin switches it.
 */
export const KEY_POLICY_GROUPS = [
  { group: 'geo', label: 'Place search and reverse geocoding', paths: ['/api/v1/geo/search', '/api/v1/geo/reverse'], keyRequired: true },
  { group: 'directions', label: 'Directions', paths: ['/api/v1/directions'], keyRequired: true },
  { group: 'aircraft', label: 'Aircraft details', paths: ['/api/v1/aircraft'], keyRequired: true },
  { group: 'flight-route', label: 'Flight routes', paths: ['/api/v1/flight-route'], keyRequired: true },
  { group: 'arcgis', label: 'ArcGIS layers', paths: ['/api/v1/arcgis'], keyRequired: true },
  { group: 'satellites', label: 'Satellite orbits', paths: ['/api/v1/satellites/orbit'], keyRequired: false },
  { group: 'markets', label: 'Market history', paths: ['/api/v1/markets/history'], keyRequired: true },
  { group: 'entity', label: 'Entity graph', paths: ['/api/v1/entity/expand'], keyRequired: true },
  { group: 'region-dossier', label: 'Region dossier', paths: ['/api/v1/region-dossier'], keyRequired: true },
  { group: 'replay', label: 'Replay and History data', paths: ['/api/replay/*'], keyRequired: true },
] as const;

/** Account and meta routes: never gated, so signing in, keys and the console keep working. */
export const OPEN_GROUPS = ['auth', 'me', 'plans', 'key-policy', 'usage', 'keys', 'account', 'workspaces', 'w', 'reports', 'openapi.json', 'docs'] as const;

export type KeyPolicyView = {
  group: string;
  label: string;
  paths: string[];
  keyRequired: boolean;
  updatedAt: number | null;
  /** The admin's email, or their id once the account is gone. */
  updatedBy: string | null;
};

type Row = { group: string; keyRequired: number; updatedAt: number; updatedBy: string | null };

/** The api_access_policy table, cached for `ttlMs`; changes made through `set` apply at once. */
export function createKeyPolicy(db: AppDb, { ttlMs = 30_000, now = () => Date.now() } = {}) {
  const rows = db.prepare(`
    SELECT p.route_group AS "group", p.key_required AS keyRequired, p.updated_at AS updatedAt, coalesce(u.email, p.updated_by) AS updatedBy
    FROM api_access_policy p LEFT JOIN auth_user u ON u.id = p.updated_by`);
  const upsert = db.prepare(`
    INSERT INTO api_access_policy (route_group, key_required, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT (route_group) DO UPDATE SET key_required = excluded.key_required, updated_at = excluded.updated_at, updated_by = excluded.updated_by`);
  const audit = db.prepare(`
    INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
    VALUES (?, 'admin', ?, 'api.key_policy.set', 'api_group', ?, ?)`);
  let cached: { at: number; required: Map<string, boolean> } | undefined;

  function list(): KeyPolicyView[] {
    const stored = new Map((rows.all() as Row[]).map(row => [row.group, row]));
    return KEY_POLICY_GROUPS.map(({ group, label, paths, keyRequired }) => {
      const row = stored.get(group);
      return { group, label, paths: [...paths], keyRequired: row ? row.keyRequired === 1 : keyRequired, updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null };
    });
  }

  return {
    list,

    /** False for groups outside KEY_POLICY_GROUPS: unknown and meta routes are never gated. */
    keyRequired(group: string) {
      if (!cached || now() - cached.at >= ttlMs) cached = { at: now(), required: new Map(list().map(g => [g.group, g.keyRequired])) };
      return cached.required.get(group) ?? false;
    },

    /** Switches `groups`, or every group when null; each change writes an audit_event. False when a group is unknown. */
    set(groups: string[] | null, keyRequired: boolean, adminId: string) {
      const current = new Map(list().map(g => [g.group, g.keyRequired]));
      const targets = groups ?? [...current.keys()];
      if (targets.some(group => !current.has(group))) return false;
      db.transaction(() => {
        const at = now();
        for (const group of targets) {
          upsert.run(group, keyRequired ? 1 : 0, at, adminId);
          if (current.get(group) !== keyRequired) audit.run(at, adminId, group, JSON.stringify({ group, keyRequired }));
        }
      })();
      cached = undefined;
      return true;
    },
  };
}

export type KeyPolicy = ReturnType<typeof createKeyPolicy>;

// Browsers set Sec-Fetch-Site and page scripts can't change it. Other clients can forge it, so this steers them to
// keys rather than locking them out; forgers still get the anonymous web.rps bucket.
const fromWebApp = (c: Context) => {
  const site = c.req.header('sec-fetch-site');
  return site === 'same-origin' || site === 'same-site';
};

/**
 * Refuses a caller with neither a key nor a session on a group that needs a key, unless the request comes
 * from the web app's own pages: the map stays open to visitors. `site` is the web app's origin.
 */
export function keyPolicyGate(policy: KeyPolicy, usage: Usage, { site, group: fixedGroup, enforce = true }: { site: string; group?: string; enforce?: boolean }) {
  const signupUrl = `${site}/?account=sign-up`;
  const body = {
    error: 'api_key_required',
    message: `This endpoint needs an API key. Get a free account at ${signupUrl}, create a key in Account settings → API keys, and send it as "Authorization: Bearer tk_…".`,
    signup_url: signupUrl,
    docs_url: `${site}/api/v1/docs`,
  };
  return createMiddleware<AccessEnv>(async (c, next) => {
    const { principal } = c.var;
    if (!enforce || principal.kind !== 'anon' || fromWebApp(c)) return next();
    const group = fixedGroup ?? routeGroup(c);
    if (!policy.keyRequired(group)) return next();
    usage.deny(principal, group);
    return c.json(body, 401, { 'WWW-Authenticate': 'Bearer' });
  });
}
