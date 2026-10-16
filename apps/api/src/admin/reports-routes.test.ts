import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Jar, ORIGIN, USER, startApp, type TestApp } from '../testing/helpers';
import { ADMIN, adminKit } from './testing';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let ada: Jar;

type Listed = {
  counts: { all: number; open: number; resolved: number };
  total: number;
  reports: { id: number; message: string; userId: string | null; email: string | null; status: string; view: Record<string, unknown>; resolvedAt: number | null; resolvedBy: string | null; resolverEmail: string | null }[];
};

beforeEach(async () => {
  t = await startApp();
  kit = adminKit(t);
  ada = await t.signUpVerified();
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

const report = async (message: string, jar?: Jar) => {
  const res = await t.app.request('/api/v1/reports', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...(jar && { cookie: jar.get() }) },
    body: JSON.stringify({ message, view: { mode: 'live', link: '/?lat=1.0&lon=2.0' } }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: number }).id;
};
const list = async (root: Jar, query = '') => kit.json<Listed>(await kit.call(root, 'GET', `/api/admin/reports${query}`));
const setStatus = (root: Jar, id: number | string, status: unknown) => kit.call(root, 'PUT', `/api/admin/reports/${id}/status`, { status });
const auditRows = () => t.db.prepare(`
  SELECT actor_id AS actorId, action, subject_type AS subjectType, subject_id AS subjectId, data FROM audit_event
  WHERE action LIKE 'report.%' ORDER BY audit_id`).all();

describe('issue reports in the console', () => {
  it('is behind the gate', async () => {
    const id = await report('Something looks off here.');
    await kit.expectGated('GET', '/api/admin/reports', ada);
    await kit.expectGated('PUT', `/api/admin/reports/${id}/status`, ada, { status: 'resolved' });
    expect(t.db.prepare('SELECT status FROM issue_report').pluck().get()).toBe('open');
  });

  it('lists reports newest first with their reporter, filtered by status and paged', async () => {
    const fromVisitor = await report('A visitor saw a ship on land.');
    const fromAda = await report('Ada saw a plane underground.', ada);
    const { jar: root } = await kit.admin();
    const third = await report('The admin found one too.', root);
    expect((await setStatus(root, fromVisitor, 'resolved')).status).toBe(200);

    const all = await list(root);
    expect(all.counts).toEqual({ all: 3, open: 2, resolved: 1 });
    expect(all.total).toBe(3);
    expect(all.reports.map(r => [r.id, r.email, r.status])).toEqual([[third, ADMIN.email, 'open'], [fromAda, USER.email, 'open'], [fromVisitor, null, 'resolved']]);
    expect(all.reports[2]).toMatchObject({ userId: null, view: { mode: 'live', link: '/?lat=1.0&lon=2.0' } });

    const open = await list(root, '?status=open');
    expect([open.total, open.reports.map(r => r.id)]).toEqual([2, [third, fromAda]]);
    const resolved = await list(root, '?status=resolved');
    expect([resolved.total, resolved.reports.map(r => r.id)]).toEqual([1, [fromVisitor]]);
    expect((await list(root, '?limit=1&offset=1')).reports.map(r => r.id)).toEqual([fromAda]);

    const bad = await kit.call(root, 'GET', '/api/admin/reports?status=closed');
    expect([bad.status, (await kit.json(bad)).error]).toEqual([400, 'invalid_request']);
  });

  it('resolves and reopens a report, writing each change to the audit log', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const id = await report('The weather radar is stuck.', ada);
    const { jar: root, id: adminId } = await kit.admin();

    expect(await kit.json(await setStatus(root, id, 'resolved'))).toEqual({ ok: true, status: 'resolved' });
    expect((await list(root)).reports[0]).toMatchObject({ status: 'resolved', resolvedAt: Date.now(), resolvedBy: adminId, resolverEmail: ADMIN.email });
    // Already resolved: nothing changes and nothing more is recorded.
    expect((await setStatus(root, id, 'resolved')).status).toBe(200);

    expect(await kit.json(await setStatus(root, id, 'open'))).toEqual({ ok: true, status: 'open' });
    expect((await list(root)).reports[0]).toMatchObject({ status: 'open', resolvedAt: null, resolvedBy: null, resolverEmail: null });

    expect(auditRows()).toEqual([
      { actorId: adminId, action: 'report.resolve', subjectType: 'report', subjectId: String(id), data: JSON.stringify({ report: id, from: 'open', to: 'resolved' }) },
      { actorId: adminId, action: 'report.reopen', subjectType: 'report', subjectId: String(id), data: JSON.stringify({ report: id, from: 'resolved', to: 'open' }) },
    ]);
  });

  it('refuses an unknown report or status', async () => {
    const id = await report('The camera shows the wrong city.');
    const { jar: root } = await kit.admin();
    for (const missing of [id + 1, 'abc', 0]) {
      const res = await setStatus(root, missing, 'resolved');
      expect([res.status, await kit.json(res)]).toEqual([404, { error: 'not_found' }]);
    }
    for (const status of ['closed', undefined, 1]) {
      const res = await setStatus(root, id, status);
      expect([res.status, (await kit.json(res)).error]).toEqual([400, 'invalid_request']);
    }
    expect(auditRows()).toEqual([]);
  });
});
