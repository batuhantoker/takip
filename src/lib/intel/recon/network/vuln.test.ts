import { describe, expect, it } from 'vitest';
import { rankVulns, riskOf, severityOf, type VulnEntry } from './vuln';

const v = (p: Partial<VulnEntry>): VulnEntry =>
  ({ id: 'CVE-0000-0000', cvss: null, severity: null, epss: null, kev: false, description: '', ...p });

describe('severityOf', () => {
  it('bands CVSS the way NVD does', () => {
    expect(severityOf(9.8)).toBe('CRITICAL');
    expect(severityOf(7)).toBe('HIGH');
    expect(severityOf(4)).toBe('MEDIUM');
    expect(severityOf(3.9)).toBe('LOW');
    expect(severityOf(null)).toBe(null);
  });
});

describe('rankVulns', () => {
  it('puts KEV above a higher CVSS that is not exploited', () => {
    const kevLow = v({ id: 'kev', cvss: 7.0, kev: true });
    const critNoKev = v({ id: 'crit', cvss: 9.9 });
    const [first] = rankVulns([critNoKev, kevLow]);
    expect(first.id).toBe('kev');
  });

  it('orders by CVSS then EPSS among non-KEV', () => {
    const a = v({ id: 'a', cvss: 8, epss: 0.1 });
    const b = v({ id: 'b', cvss: 8, epss: 0.9 });
    const c = v({ id: 'c', cvss: 9 });
    expect(rankVulns([a, b, c]).map(x => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate its input', () => {
    const list = [v({ id: 'a', cvss: 1 }), v({ id: 'b', cvss: 9 })];
    rankVulns(list);
    expect(list.map(x => x.id)).toEqual(['a', 'b']);
  });
});

describe('riskOf', () => {
  it('is driven by the whole set, not just the first entry', () => {
    // A critical sitting past the display cut-off must still raise the risk.
    const list = [v({ cvss: 5 }), v({ cvss: 5 }), v({ cvss: 9.8 })];
    expect(riskOf(list)).toBe('CRITICAL');
  });
  it('treats a KEV as critical regardless of score', () => {
    expect(riskOf([v({ cvss: 6, kev: true })])).toBe('CRITICAL');
  });
  it('is NONE for an empty list', () => {
    expect(riskOf([])).toBe('NONE');
  });
});
