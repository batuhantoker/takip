import { validateHost } from '@/lib/ssrf-guard';

export interface VulnEntry {
  id: string;
  cvss: number | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
  epss: number | null;
  kev: boolean;
  description: string;
}
export interface VulnReport {
  target: string;
  ip: string | null;
  software: string[];
  /** The highest-ranked entries, KEV first, then CVSS, then EPSS. */
  vulnerabilities: VulnEntry[];
  /** Every CVE InternetDB lists for the host, including ones not in `vulnerabilities`. */
  total: number;
  counts: { critical: number; high: number; medium: number; low: number; kev: number };
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  /** True when the host lists more CVEs than we score; the rest are unranked. */
  truncated: boolean;
  error?: string;
}

const UA = { 'User-Agent': 'Mozilla/5.0 TAKIP-Recon', Accept: 'application/json' };
const MAX_ENRICHED = 300;
const MAX_SHOWN = 80;

export function severityOf(cvss: number | null): VulnEntry['severity'] {
  if (cvss == null) return null;
  if (cvss >= 9) return 'CRITICAL';
  if (cvss >= 7) return 'HIGH';
  if (cvss >= 4) return 'MEDIUM';
  return 'LOW';
}

export function rankVulns(list: VulnEntry[]): VulnEntry[] {
  const score = (v: VulnEntry) => (v.kev ? 1000 : 0) + (v.cvss ?? 0) * 10 + (v.epss ?? 0);
  return [...list].sort((a, b) => score(b) - score(a));
}

export function riskOf(ranked: VulnEntry[]): VulnReport['risk_level'] {
  if (!ranked.length) return 'NONE';
  if (ranked.some(v => v.kev || (v.cvss ?? 0) >= 9)) return 'CRITICAL';
  if (ranked.some(v => (v.cvss ?? 0) >= 7)) return 'HIGH';
  if (ranked.some(v => (v.cvss ?? 0) >= 4)) return 'MEDIUM';
  return 'LOW';
}

function countOf(list: VulnEntry[]): VulnReport['counts'] {
  const c = { critical: 0, high: 0, medium: 0, low: 0, kev: 0 };
  for (const v of list) {
    if (v.kev) c.kev++;
    if (v.severity === 'CRITICAL') c.critical++;
    else if (v.severity === 'HIGH') c.high++;
    else if (v.severity === 'MEDIUM') c.medium++;
    else if (v.severity === 'LOW') c.low++;
  }
  return c;
}

/** Resolve a hostname to a public IP; a literal address passes straight through. */
async function resolveTarget(target: string): Promise<string | null> {
  const guard = await validateHost(target);
  return guard.ok ? (guard.resolved?.find(a => a.includes('.')) ?? guard.resolved?.[0] ?? null) : null;
}

/** One CVE's CVSS / EPSS / KEV from Shodan's CVEDB (keyless, one call per id). Terms: not yet checked. */
async function enrich(id: string, signal: AbortSignal): Promise<VulnEntry> {
  try {
    const res = await fetch(`https://cvedb.shodan.io/cve/${encodeURIComponent(id)}`, { signal, headers: UA });
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    const cvss = d.cvss != null ? Number(d.cvss) : NaN;
    const epss = d.epss != null ? Number(d.epss) : NaN;
    return {
      id,
      cvss: Number.isFinite(cvss) ? cvss : null,
      severity: severityOf(Number.isFinite(cvss) ? cvss : null),
      epss: Number.isFinite(epss) ? epss : null,
      kev: d.kev === true || d.kev === 'true',
      description: typeof d.summary === 'string' ? d.summary : '',
    };
  } catch {
    return { id, cvss: null, severity: null, epss: null, kev: false, description: '' };
  }
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

/**
 * Known vulnerabilities for a host: the CVEs Shodan's InternetDB has recorded
 * against it, each enriched with CVSS, EPSS (exploitation probability) and
 * whether CISA lists it as actively exploited (KEV). Every listed CVE is scored
 * before ranking, so the top of the list really is the worst. Keyless.
 */
export async function findVulnerabilities(target: string, timeoutMs = 45_000): Promise<VulnReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const base: VulnReport = {
    target, ip: null, software: [], vulnerabilities: [], total: 0,
    counts: { critical: 0, high: 0, medium: 0, low: 0, kev: 0 }, risk_level: 'NONE', truncated: false,
  };

  try {
    const ip = await resolveTarget(target);
    if (!ip) return { ...base, error: 'Could not resolve a public address for that target.' };

    // Terms: InternetDB is free for non-commercial use.
    const res = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, { signal: controller.signal, headers: UA, cache: 'no-store' });
    if (res.status === 404) return { ...base, ip };
    if (!res.ok) throw new Error(`InternetDB ${res.status}`);
    const data = await res.json();

    const cpes: string[] = Array.isArray(data.cpes) ? data.cpes : [];
    const cves: string[] = Array.isArray(data.vulns) ? data.vulns : [];
    const scored = await mapLimited(cves.slice(0, MAX_ENRICHED), 12, id => enrich(id, controller.signal));
    const ranked = rankVulns(scored);

    return {
      target, ip, software: cpes,
      vulnerabilities: ranked.slice(0, MAX_SHOWN),
      total: cves.length,
      counts: countOf(scored),
      risk_level: riskOf(ranked),
      truncated: cves.length > MAX_ENRICHED,
    };
  } finally {
    clearTimeout(timer);
  }
}
