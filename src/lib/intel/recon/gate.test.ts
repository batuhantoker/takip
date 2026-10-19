import { afterEach, describe, expect, it, vi } from 'vitest';
import { reconGate } from './gate';

const request = () => new Request('http://localhost:3000/api/osint/portscan?host=example.com', { headers: { cookie: 'takip.session_token=abc' } });

function apiAnswers(entitlements: Record<string, unknown>, id = 'u1') {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ plan: { id: 'free', name: 'Free' }, entitlements, subscription: null, subject: { type: 'user', id } }));
}

afterEach(() => vi.restoreAllMocks());

describe('reconGate', () => {
  it('refuses a probe to a plan without recon.scan', async () => {
    apiAnswers({ 'recon.scan': false }, 'free-user');
    const denied = await reconGate(request(), 'scan', { probe: true });
    expect(denied?.status).toBe(403);
    expect(await denied?.json()).toMatchObject({ error: 'entitlement_required', entitlement: 'recon.scan' });
  });

  it('lets a probe through on a plan with recon.scan', async () => {
    apiAnswers({ 'recon.scan': true }, 'pro-user');
    expect(await reconGate(request(), 'scan', { probe: true })).toBeNull();
  });

  it('leaves lookups that are not probes to the account and its limits', async () => {
    apiAnswers({ 'recon.scan': false }, 'lookup-user');
    expect(await reconGate(request(), 'network')).toBeNull();
  });
});
