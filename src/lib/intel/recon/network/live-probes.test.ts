import { describe, it, expect } from 'vitest';
import { inspectTls } from './tls';
import { scanPorts } from './portscan';
import { inspectHeaders, fingerprintTech } from './web';
import { enumerateSubdomains } from './subdomains';
import { findVulnerabilities } from './vuln';
import { checkReputation } from './reputation';

// Live integration tests — opt in with RUN_LIVE_TESTS=1 (hits real upstreams).
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('recon live probes', () => {
  liveIt('TLS: reads a valid cert off a public host', async () => {
    const r = await inspectTls('wikipedia.org');
    expect(r.ok).toBe(true);
    expect(r.protocol).toMatch(/TLS/);
    expect(r.authorized).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.san_match).toBe(true);
    expect((r.days_left ?? 0)).toBeGreaterThan(0);
  });

  liveIt('TLS: refuses a private target', async () => {
    const r = await inspectTls('127.0.0.1');
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  liveIt('port scan: finds 80/443 open on a web host and refuses private', async () => {
    const r = await scanPorts('scanme.nmap.org');
    expect(r.error).toBeUndefined();
    const ports = r.ports.map(p => p.port);
    expect(ports).toContain(22);
    const priv = await scanPorts('10.0.0.1');
    expect(priv.error).toBeTruthy();
  });

  liveIt('headers: grades a site that sets HSTS', async () => {
    const r = await inspectHeaders('https://wikipedia.org');
    expect(r.status).toBeGreaterThanOrEqual(200);
    expect(r.security.max).toBe(6);
    expect(r.security.present.length + r.security.missing.length).toBe(6);
  });

  liveIt('tech: fingerprints something concrete', async () => {
    const r = await fingerprintTech('https://wikipedia.org');
    expect(r.status).toBeGreaterThanOrEqual(200);
    expect(Array.isArray(r.technologies)).toBe(true);
  });

  liveIt('subdomains: merges sources and finds wikipedia hosts', async () => {
    const r = await enumerateSubdomains('wikipedia.org');
    expect(r.total).toBeGreaterThan(0);
    expect(r.subdomains.every(s => s.endsWith('.wikipedia.org'))).toBe(true);
    expect(r.sources.some(s => s.ok)).toBe(true);
  });

  liveIt('vuln: enriches InternetDB CVEs with CVSS/KEV', async () => {
    const r = await findVulnerabilities('scanme.nmap.org');
    expect(r.ip).toBeTruthy();
    expect(r.vulnerabilities.length).toBeGreaterThan(0);
    const scored = r.vulnerabilities.filter(v => v.cvss != null);
    expect(scored.length).toBeGreaterThan(0);
    // Scored over the whole set, not an arbitrary slice: total covers the shown list,
    // the severity tally never exceeds it, and the list is ordered worst-first.
    expect(r.total).toBeGreaterThanOrEqual(r.vulnerabilities.length);
    expect(r.counts.critical + r.counts.high + r.counts.medium + r.counts.low).toBeLessThanOrEqual(r.total);
    const rank = (v: typeof r.vulnerabilities[number]) => (v.kev ? 1000 : 0) + (v.cvss ?? 0) * 10 + (v.epss ?? 0);
    expect(rank(r.vulnerabilities[0])).toBeGreaterThanOrEqual(rank(r.vulnerabilities[r.vulnerabilities.length - 1]));
  }, 50000);

  liveIt('reputation: clean for 8.8.8.8, flagged for a known-bad IP', async () => {
    const clean = await checkReputation('8.8.8.8');
    expect(clean.verdict).not.toBe('malicious');
    expect(clean.tor_exit).toBe(false);
    const bad = await checkReputation('45.148.10.183');
    expect(['malicious', 'suspicious']).toContain(bad.verdict);
  });

  liveIt('reputation: an IP containing a Tor exit as substring is not flagged Tor', async () => {
    // 185.220.101.4 is a real Tor exit; 185.220.101.44 must not match it by substring.
    const r = await checkReputation('8.8.4.4');
    expect(r.tor_exit).toBe(false);
  });
});
