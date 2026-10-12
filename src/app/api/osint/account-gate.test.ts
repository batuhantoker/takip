import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as dns } from './dns/route';
import { GET as leaks } from './leaks/route';
import { GET as phone } from './phone/route';
import { GET as sanctions } from './sanctions/route';
import { GET as sweep } from './sweep/route';
import { GET as scanner } from '../scanner/route';

const ACCESS = /\/api\/v1\/me\/access$/;

let ips = 0;
let accounts = 0;
const nextIp = () => `198.51.100.${++ips}`;
const newAccount = () => ({ type: 'user', id: `u${++accounts}` }) as const;

const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { headers: { 'x-forwarded-for': nextIp(), ...headers } });

function apiAnswers(subject: { type: 'user'; id: string } | null | Error) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    if (!ACCESS.test(String(input))) throw new Error(`unexpected fetch: ${String(input)}`);
    if (subject instanceof Error) throw subject;
    return Response.json({ plan: { id: subject ? 'free' : 'anon', name: '' }, entitlements: {}, subscription: null, subject });
  });
}

afterEach(() => vi.restoreAllMocks());

// Without their parameter these answer 400 before any upstream call, so passing the gate is visible on its own.
const families = [
  { family: 'breach', route: leaks, path: '/api/osint/leaks' },
  { family: 'people', route: phone, path: '/api/osint/phone' },
  { family: 'scan', route: sweep, path: '/api/osint/sweep' },
  { family: 'network', route: dns, path: '/api/osint/dns' },
  { family: 'reference', route: sanctions, path: '/api/osint/sanctions' },
];

describe.each(families)('$family ($path)', ({ route, path }) => {
  it('refuses a visitor with sign_in_required', async () => {
    apiAnswers(null);
    const res = await route(get(path));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'sign_in_required' });
  });

  it('lets a signed-in user through', async () => {
    apiAnswers(newAccount());
    expect((await route(get(path))).status).toBe(400);
  });

  it('refuses everyone when the api is down', async () => {
    apiAnswers(new TypeError('fetch failed'));
    const res = await route(get(path));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'access_unavailable' });
  });
});

describe('the scanner', () => {
  it('asks for an account before anything else, even whether it is configured', async () => {
    apiAnswers(null);
    expect((await scanner(get('/api/scanner'))).status).toBe(401);
    vi.restoreAllMocks();
    apiAnswers(newAccount());
    expect((await scanner(get('/api/scanner'))).status).not.toBe(401);
  });
});

describe('an API key', () => {
  it('reaches the api and passes as its owner', async () => {
    const fetch = apiAnswers(newAccount());
    expect((await dns(get('/api/osint/dns', { authorization: 'Bearer tk_abc' }))).status).toBe(400);
    expect((fetch.mock.calls[0][1]?.headers as Record<string, string>).authorization).toBe('Bearer tk_abc');
  });
});

describe('per-account limits', () => {
  it('stop an account at its breach allowance, from any address, and leave other accounts alone', async () => {
    const ada = newAccount();
    apiAnswers(ada);
    for (let i = 0; i < 20; i++) expect((await leaks(get('/api/osint/leaks'))).status).toBe(400);
    const refused = await leaks(get('/api/osint/leaks'));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ error: 'rate_limited' });

    vi.restoreAllMocks();
    apiAnswers(newAccount());
    expect((await leaks(get('/api/osint/leaks'))).status).toBe(400);
  });

  it('count each family on its own', async () => {
    apiAnswers(newAccount());
    for (let i = 0; i < 20; i++) await leaks(get('/api/osint/leaks'));
    expect((await leaks(get('/api/osint/leaks'))).status).toBe(429);
    expect((await dns(get('/api/osint/dns'))).status).toBe(400);
  });
});
