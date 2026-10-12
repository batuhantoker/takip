import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSourceSwitchboard, type SourceState, type SourceSwitchboard } from '../replay/sources';
import { Jar, startApp, totp, type TestApp } from '../testing/helpers';
import { createAdminGate, type AdminEnv } from './gate';
import { sourcesRoutes } from './sources-routes';

const ADMIN = { name: 'Root', email: 'root@example.com', password: 'admin horse battery staple' };

let t: TestApp;
let dir: string;
let board: SourceSwitchboard;
let sources: Hono;

beforeEach(async () => {
  t = await startApp();
  dir = mkdtempSync(join(tmpdir(), 'admin-sources-'));
  board = openSourceSwitchboard({ dataDir: dir, archiveDir: join(dir, 'archive') });
  // As admin/routes.ts mounts it: behind the gate, on the same auth and app.db.
  const gated = new Hono<AdminEnv>();
  gated.use('*', createAdminGate(t.auth, t.db).requireAdmin);
  gated.route('/', sourcesRoutes({ db: t.db, switchboard: board }));
  sources = new Hono().route('/api/admin/sources', gated);
});

afterEach(() => {
  board.close();
  t.close();
  rmSync(dir, { recursive: true, force: true });
});

const request = (app: { request: Hono['request'] }, jar: Jar | null, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { origin: 'http://localhost:3000', ...(body !== undefined && { 'content-type': 'application/json' }), ...(jar && { cookie: jar.get() }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

/** Signed up, promoted, 2FA on and the console unlocked, as admin.test.ts does it. */
async function unlockedAdmin() {
  const jar = await t.signUpVerified(new Jar(), ADMIN);
  const userId = (await t.session(jar.get()))!.user.id;
  t.db.prepare("UPDATE auth_user SET role = 'admin' WHERE id = ?").run(userId);
  const enabled = (await (await request(t.app, jar, 'POST', '/api/auth/two-factor/enable', { password: ADMIN.password })).json()) as { totpURI: string };
  const secret = new URL(enabled.totpURI).searchParams.get('secret')!;
  jar.take(await request(t.app, jar, 'POST', '/api/auth/two-factor/verify-totp', { code: totp(secret) }));
  expect((await request(t.app, jar, 'POST', '/api/admin/unlock', { code: totp(secret) })).status).toBe(200);
  return { jar, userId };
}

describe('/api/admin/sources', () => {
  it('is closed to visitors and ordinary users', async () => {
    const visitor = await request(sources, null, 'GET', '/api/admin/sources');
    expect([visitor.status, await visitor.json()]).toEqual([401, { error: 'sign_in_required' }]);
    const user = await request(sources, await t.signUpVerified(), 'PUT', '/api/admin/sources/cctv', { record: false });
    expect([user.status, await user.json()]).toEqual([403, { error: 'admin_only' }]);
  });

  it('lists sources and switches one, telling the recorder and writing the audit log', async () => {
    const { jar, userId } = await unlockedAdmin();
    const list = (await (await request(sources, jar, 'GET', '/api/admin/sources')).json()) as { sources: SourceState[] };
    expect(list.sources.find(s => s.code === 'opensky')).toMatchObject({ record: true, build: true, coverage: null });

    const res = await request(sources, jar, 'PUT', '/api/admin/sources/cctv', { record: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, source: { code: 'cctv', record: false, build: true, switchedBy: `admin:${userId}` } });
    expect(JSON.parse(readFileSync(join(dir, 'archive', 'control.json'), 'utf8')).sources.cctv).toEqual({ record: false });
    expect(t.db.prepare(`SELECT actor_id, subject_type, subject_id, data FROM audit_event WHERE action = 'source.switch'`).get()).toEqual({
      actor_id: userId, subject_type: 'source', subject_id: 'cctv', data: '{"code":"cctv","record":false,"build":true}',
    });
  });

  it('refuses empty or malformed changes and unknown sources', async () => {
    const { jar } = await unlockedAdmin();
    for (const body of [{}, { record: 'off' }, { record: true, colour: 'red' }]) {
      const res = await request(sources, jar, 'PUT', '/api/admin/sources/cctv', body);
      expect([res.status, ((await res.json()) as { error: string }).error]).toEqual([400, 'invalid_request']);
    }
    const unknown = await request(sources, jar, 'PUT', '/api/admin/sources/nope', { build: false });
    expect([unknown.status, await unknown.json()]).toEqual([404, { error: 'not_found' }]);
  });
});
