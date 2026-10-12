import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startApp, type TestApp } from '../testing/helpers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
});

afterEach(() => t.close());

const get = (path: string, id?: string) => t.app.request(path, { headers: id === undefined ? {} : { 'x-request-id': id } });
const idOf = (res: Response) => res.headers.get('x-request-id');

describe('X-Request-Id', () => {
  it("echoes the caller's id when it is well-formed", async () => {
    for (const id of ['a', 'Req_01-XYZ', 'x'.repeat(64)]) {
      expect(idOf(await get('/health', id))).toBe(id);
    }
  });

  it('replaces anything else with a fresh UUID', async () => {
    for (const id of ['', 'has space', 'a.b', '<script>', 'id;drop', 'base64==', 'ü', 'x'.repeat(65)]) {
      const echoed = idOf(await get('/health', id));
      expect(echoed, id).toMatch(UUID);
    }
  });

  it('mints a new id for each request that brings none', async () => {
    const [first, second] = [idOf(await get('/health')), idOf(await get('/health'))];
    expect(first).toMatch(UUID);
    expect(second).toMatch(UUID);
    expect(first).not.toBe(second);
  });

  it("survives responses a handler builds itself, 404s and errors", async () => {
    t.app.get('/boom', () => {
      throw new Error('boom');
    });
    // Better Auth answers with its own Response object.
    expect(idOf(await get('/api/auth/get-session', 'auth-1'))).toBe('auth-1');
    expect(idOf(await get('/api/v1/plans', 'v1-1'))).toBe('v1-1');
    const missing = await get('/no/such/path', 'missing-1');
    expect([missing.status, idOf(missing)]).toEqual([404, 'missing-1']);
    const failed = await get('/boom', 'boom-1');
    expect([failed.status, idOf(failed)]).toEqual([500, 'boom-1']);
  });

  it('is on c.var for handlers', async () => {
    t.app.get('/whoami', c => c.text(c.var.requestId));
    const res = await get('/whoami', 'var-1');
    expect(await res.text()).toBe('var-1');
  });
});
