import { describe, expect, it } from 'vitest';
import { BROWSER_PROBE_TABS, lookupError, lookupUrl, needsSignIn } from './lookup';

describe('lookupError', () => {
  it('puts a per-account limit in words', () => {
    expect(lookupError({ error: 'rate_limited', retry_after: 40 }, 'Lookup failed')).toBe('Limit reached. Try again in 40 s.');
    expect(lookupError({ error: 'rate_limited', retry_after: 150 }, 'Lookup failed')).toBe('Limit reached. Try again in 3 min.');
  });

  it('keeps any other error, and falls back without one', () => {
    expect(lookupError({ error: 'sign_in_required' }, 'Lookup failed')).toBe('sign_in_required');
    expect(lookupError({}, 'Lookup failed')).toBe('Lookup failed');
  });
});

describe('needsSignIn', () => {
  it('stops a visitor at the tabs that call a provider from the browser, and nowhere else', () => {
    for (const tab of ['leaks', 'shodan', 'sweep']) expect(needsSignIn(tab, false), tab).toBe(true);
    for (const tab of ['dns', 'scanner', 'username', 'fingerprint']) expect(needsSignIn(tab, false), tab).toBe(false);
  });

  it('lets a signed-in user run every tab', () => {
    for (const tab of ['leaks', 'shodan', 'sweep', 'dns']) expect(needsSignIn(tab, true), tab).toBe(false);
  });

  it('covers every lookup that leaves this origin', () => {
    const tabs = ['dns', 'certs', 'whois', 'threats', 'bgp', 'mac', 'phone', 'leaks', 'crypto', 'username', 'github', 'vuln', 'scanner', 'headers', 'ssl', 'subdomains', 'tech', 'shodan'];
    const external = tabs.filter(tab => !lookupUrl(tab, 'q').startsWith('/api/'));
    expect(external).toEqual(['leaks', 'shodan']);
    for (const tab of external) expect(BROWSER_PROBE_TABS.has(tab), tab).toBe(true);
  });
});
