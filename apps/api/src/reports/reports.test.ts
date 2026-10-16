import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Jar, ORIGIN, startApp, type TestApp } from '../testing/helpers';
import { REPORT_BURST } from './routes';
import { MAX_BODY, MAX_MESSAGE } from './schemas';

const VIEW = {
  link: '/?lat=41.0082&lon=28.9784&zoom=9.50&layers=flights,ships',
  center: { lat: 41.0082, lng: 28.9784 },
  zoom: 9.5,
  bearing: 12,
  pitch: 40,
  mode: 'replay',
  time: '2026-10-15T08:30:00.000Z',
  track: 'aircraft:4bb1c2',
  baseMap: 'dark',
  projection: 'globe',
  theme: 'core',
  layers: ['flights', 'ships'],
  panel: 'layers',
  viewport: { width: 1440, height: 900 },
  version: 'V5.0',
};
const MESSAGE = 'The ferry from Kadıköy is drawn on land.';

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

const send = (body: unknown, { jar, headers = {} }: { jar?: Jar; headers?: Record<string, string> } = {}) =>
  t.app.request('/api/v1/reports', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', 'user-agent': 'Firefox/141', ...(jar && { cookie: jar.get() }), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const reply = async (res: Response) => [res.status, (await res.json()) as { error?: string; id?: number; retry_after?: number }] as const;
const rows = () => t.db.prepare('SELECT * FROM issue_report ORDER BY report_id').all() as Record<string, unknown>[];

describe('POST /api/v1/reports', () => {
  it('takes a visitor’s report with the view they were looking at', async () => {
    const [status, body] = await reply(await send({ message: `  ${MESSAGE}  `, view: VIEW }));
    expect([status, body]).toEqual([201, { ok: true, id: 1 }]);
    expect(rows()).toEqual([{
      report_id: 1, created_at: expect.any(Number), user_id: null, message: MESSAGE, view: JSON.stringify(VIEW),
      user_agent: 'Firefox/141', status: 'open', resolved_at: null, resolved_by: null,
    }]);
  });

  it('ties a signed-in user’s report to their account, and needs no view', async () => {
    const jar = await t.signUpVerified();
    const userId = (await t.session(jar.get()))!.user.id;
    expect((await send({ message: MESSAGE }, { jar })).status).toBe(201);
    expect(rows()).toMatchObject([{ user_id: userId, view: '{}' }]);
  });

  it('drops view fields it does not know', async () => {
    expect((await send({ message: MESSAGE, view: { mode: 'live', secret: 'x' } })).status).toBe(201);
    expect(rows()[0].view).toBe('{"mode":"live"}');
  });

  it('refuses a missing, short or long message and a malformed view, storing nothing', async () => {
    const bad = [
      {},
      { message: 'too short' },
      { message: '   short   ' },
      { message: 'x'.repeat(MAX_MESSAGE + 1) },
      { message: MESSAGE, view: { mode: 'paused' } },
      { message: MESSAGE, view: { zoom: 'far' } },
      { message: MESSAGE, view: { center: { lat: 91, lng: 0 } } },
      { message: MESSAGE, view: { layers: ['x'.repeat(65)] } },
      { message: MESSAGE, view: { link: `/?${'a'.repeat(2000)}` } },
      'not json',
    ];
    for (const body of bad) expect(await reply(await send(body)), JSON.stringify(body)).toMatchObject([400, { error: 'invalid_request' }]);
    expect(rows()).toEqual([]);
  });

  it('keeps the view link on this site', async () => {
    for (const link of ['https://evil.example/', '//evil.example/', '/\\evil.example/', 'javascript:alert(1)', '/ ok', '?lat=1']) {
      expect(await reply(await send({ message: MESSAGE, view: { link } })), link).toMatchObject([400, { error: 'invalid_request' }]);
    }
    expect((await send({ message: MESSAGE, view: { link: '/' } })).status).toBe(201);
  });

  it('refuses a body over the cap', async () => {
    const [status, body] = await reply(await send({ message: MESSAGE, view: { ...VIEW, padding: 'x'.repeat(MAX_BODY) } }));
    expect([status, body]).toEqual([413, { error: 'too_large', limit: MAX_BODY }]);
  });

  it(`takes ${REPORT_BURST} at once from one caller, then one every ten minutes; refused ones cost nothing`, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    expect((await send({ message: 'short' })).status).toBe(400);
    for (let i = 0; i < REPORT_BURST; i++) expect((await send({ message: `${MESSAGE} ${i}` })).status).toBe(201);

    const refused = await send({ message: MESSAGE });
    expect(await reply(refused)).toEqual([429, { error: 'rate_limited', retry_after: 600 }]);
    expect(refused.headers.get('retry-after')).toBe('600');
    expect(rows()).toHaveLength(REPORT_BURST);

    // A signed-in user is a caller of their own, even from the same address.
    expect((await send({ message: MESSAGE }, { jar: await t.signUpVerified() })).status).toBe(201);

    vi.setSystemTime(Date.now() + 600_000);
    expect((await send({ message: MESSAGE })).status).toBe(201);
    expect((await send({ message: MESSAGE })).status).toBe(429);
  });

  it('is in the OpenAPI spec', async () => {
    const spec = (await (await t.app.request('/api/v1/openapi.json')).json()) as { paths: Record<string, { post?: { responses: object } }> };
    expect(Object.keys(spec.paths['/reports'].post!.responses)).toEqual(['201', '400', '413', '429']);
  });
});
