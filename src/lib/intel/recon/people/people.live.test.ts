import { describe, expect, it } from 'vitest';
import { extractProfile } from './extract';
import { avatarHash } from './avatar';
import { enrichProfiles } from './enrich';
import { correlate } from './correlate';
import { lookupEmail } from './email';
import { scanUsername } from '@/lib/intel/recon/username/scan';

// Live integration tests — opt in with RUN_LIVE_TESTS=1 (hits real upstreams). Public example accounts only.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
const opts = { timeoutMs: 10_000 };

describe('people live', () => {
  liveIt('extractors read public example accounts', async () => {
    const [gh, kb, gr, li, dev, hn] = await Promise.all([
      extractProfile('GitHub', 'octocat', opts),
      extractProfile('Keybase', 'chris', opts),
      extractProfile('Gravatar', 'beau', opts),
      extractProfile('Lichess', 'thibault', opts),
      extractProfile('DEV Community', 'ben', opts),
      extractProfile('HackerNews', 'pg', opts),
    ]);
    // GitHub allows 60 unauthenticated calls an hour, so it may have nothing to say.
    if (gh) expect(gh.name).toBe('The Octocat');
    expect(kb?.verified.length).toBeGreaterThan(0);
    expect(gr?.name).toBeTruthy();
    expect(li?.name).toBeTruthy();
    expect(dev?.verified.length).toBeGreaterThan(0);
    expect(hn?.joined).toBeTruthy();
  });

  liveIt('looks up a public project address', async () => {
    const r = await lookupEmail('security@python.org');
    expect(r.mail?.mx.length).toBeGreaterThan(0);
    expect(r.pgp?.fingerprint).toBe('F314452FE3F9BF8704357732D273E0FFD067453C');
    expect(r.usernames[0]).toEqual({ value: 'security', from: ['the address'] });
  });

  liveIt('hashes a public avatar', async () => {
    expect(await avatarHash('https://avatars.githubusercontent.com/u/583231?v=4', opts)).toMatch(/^[0-9a-f]{16}$/);
  });

  liveIt('sweeps, reads and ties together a handle', async () => {
    const handle = process.env.LIVE_HANDLE || 'malgorithms';
    const scan = await scanUsername(handle, { all: process.env.LIVE_ALL !== '0', concurrency: Number(process.env.LIVE_CONCURRENCY || 18), timeoutMs: 6000, readPages: true });
    const details = await enrichProfiles(handle, scan.found);
    const { matches, identity } = correlate(handle, scan.found.map(r => ({ site: r.site, url: r.url, facts: details.get(r.site)?.facts, photo: details.get(r.site)?.photo })));
    if (process.env.LIVE_OUT) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(process.env.LIVE_OUT, JSON.stringify({ scan: { ...scan, found: scan.found.map(r => ({ ...r, facts: details.get(r.site) })) }, matches, identity }, null, 1));
    }
    expect(scan.found.length).toBeGreaterThan(0);
    expect(Object.keys(matches)).toHaveLength(scan.found.length);
  }, 120_000);
});
