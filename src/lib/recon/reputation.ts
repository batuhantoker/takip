import { cachedSource } from '@/lib/sourceCache';
import { parseIPv4, ipToNumber } from './osint-utils';

const UA = { 'User-Agent': 'Mozilla/5.0 TAKIP-Recon', Accept: 'application/json, text/plain, */*' };
const LIST_TTL = 60 * 60 * 1000; // an hour; these feeds update on that order

export interface FeodoEntry { ip: string; malware: string; port: number | null; status: string | null; last_online: string | null }
export interface DropEntry { net: number; mask: number; cidr: string; sblid: string }

export interface Reputation {
  query: string;
  kind: 'ip' | 'domain';
  verdict: 'malicious' | 'suspicious' | 'clean' | 'unknown';
  signals: string[];
  tor_exit: boolean | null;
  greynoise: { noise: boolean; riot: boolean; classification: string | null; name: string | null; last_seen: string | null } | null;
  feodo: FeodoEntry | null;
  spamhaus: { cidr: string; sblid: string } | null;
  otx: { pulse_count: number; reputation: number | null; whitelisted: boolean; country?: string | null; asn?: string | null } | null;
}

/* ── cached lists ──────────────────────────────────────────── */

// Terms: the Tor Project publishes this list for anyone to use.
const torExitList = cachedSource<string>('recon:tor-exits', async () => {
  const res = await fetch('https://check.torproject.org/torbulkexitlist', { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`tor ${res.status}`);
  return (await res.text()).split('\n').map(s => s.trim()).filter(Boolean);
}, LIST_TTL);

// Terms: abuse.ch Feodo Tracker; licence not yet checked (data-sources.md: Verify).
const feodoList = cachedSource<FeodoEntry>('recon:feodo', async () => {
  const res = await fetch('https://feodotracker.abuse.ch/downloads/ipblocklist.json', { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`feodo ${res.status}`);
  const rows: Record<string, unknown>[] = await res.json();
  return rows.map(r => ({
    ip: String(r.ip_address), malware: String(r.malware ?? 'unknown'),
    port: r.port != null ? Number(r.port) : null,
    status: r.status != null ? String(r.status) : null,
    last_online: r.last_online != null ? String(r.last_online) : null,
  }));
}, LIST_TTL);

// Terms: free to use under spamhaus.org/drop/terms, linked from the file's own metadata line.
const dropList = cachedSource<DropEntry>('recon:spamhaus-drop', async () => {
  const res = await fetch('https://www.spamhaus.org/drop/drop_v4.json', { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`spamhaus ${res.status}`);
  const text = await res.text();
  const out: DropEntry[] = [];
  for (const line of text.split('\n')) {
    const row = line.trim();
    if (!row) continue;
    let parsed: { cidr?: string; sblid?: string };
    try { parsed = JSON.parse(row); } catch { continue; }
    if (!parsed.cidr) continue; // skips the trailing metadata record
    const [addr, bits] = parsed.cidr.split('/');
    const octets = parseIPv4(addr);
    if (!octets) continue;
    const prefix = Number(bits);
    const mask = prefix <= 0 ? 0 : (prefix >= 32 ? 0xffffffff : (0xffffffff << (32 - prefix)) >>> 0);
    out.push({ net: (ipToNumber(octets) & mask) >>> 0, mask, cidr: parsed.cidr, sblid: String(parsed.sblid ?? '') });
  }
  return out;
}, LIST_TTL);

/* ── per-indicator sources ─────────────────────────────────── */

// Terms: GreyNoise Community API, keyless and rate-limited per address; commercial use not yet checked.
async function greynoise(ip: string, signal: AbortSignal): Promise<Reputation['greynoise']> {
  try {
    const res = await fetch(`https://api.greynoise.io/v3/community/${encodeURIComponent(ip)}`, { headers: UA, signal });
    if (!res.ok && res.status !== 404) return null;
    const d = await res.json();
    return {
      noise: d.noise === true, riot: d.riot === true,
      classification: d.classification ?? null, name: d.name && d.name !== 'unknown' ? d.name : null,
      last_seen: d.last_seen ?? null,
    };
  } catch { return null; }
}

// Terms: AlienVault OTX indicator API, keyless for reads; licence not yet checked.
async function otxIndicator(query: string, isIp: boolean, signal: AbortSignal): Promise<Reputation['otx']> {
  try {
    const kind = isIp ? 'IPv4' : 'domain';
    const res = await fetch(`https://otx.alienvault.com/api/v1/indicators/${kind}/${encodeURIComponent(query)}/general`, { headers: UA, signal });
    if (!res.ok) return null;
    const d = await res.json();
    const validation: { source?: string }[] = Array.isArray(d.validation) ? d.validation : [];
    return {
      pulse_count: d.pulse_info?.count ?? 0,
      reputation: typeof d.reputation === 'number' ? d.reputation : null,
      whitelisted: validation.some(v => /whitelist|false_positive/i.test(v.source ?? '')),
      country: d.country_name ?? null,
      asn: d.asn ?? null,
    };
  } catch { return null; }
}

const isIpv4 = (q: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(q) && q.split('.').every(n => +n <= 255);

/**
 * Reputation for an IP or domain, merged from independent public feeds:
 * GreyNoise (scanner classification), abuse.ch Feodo (botnet C2), Spamhaus
 * DROP (hijacked / do-not-route ranges), the Tor exit list and AlienVault OTX.
 * The verdict weighs confirmed-malicious signals above mere mentions, and OTX
 * whitelist / false-positive entries are treated as "not a threat".
 */
export async function checkReputation(query: string): Promise<Reputation> {
  const q = query.trim();
  const isIp = isIpv4(q);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  const rep: Reputation = {
    query: q, kind: isIp ? 'ip' : 'domain', verdict: 'unknown', signals: [],
    tor_exit: isIp ? false : null, greynoise: null, feodo: null, spamhaus: null, otx: null,
  };

  try {
    if (isIp) {
      const octets = parseIPv4(q);
      const ipNum = octets ? ipToNumber(octets) : null;
      const [tor, feodo, drop, gn, otx] = await Promise.all([
        torExitList().catch(() => [] as string[]),
        feodoList().catch(() => [] as FeodoEntry[]),
        dropList().catch(() => [] as DropEntry[]),
        greynoise(q, controller.signal),
        otxIndicator(q, true, controller.signal),
      ]);
      rep.tor_exit = tor.includes(q);
      rep.feodo = feodo.find(f => f.ip === q) ?? null;
      rep.spamhaus = ipNum != null ? (drop.find(e => ((ipNum & e.mask) >>> 0) === e.net) ?? null) : null;
      rep.greynoise = gn;
      rep.otx = otx;
    } else {
      rep.otx = await otxIndicator(q, false, controller.signal);
    }
  } finally {
    clearTimeout(timer);
  }

  // Signals and verdict.
  const signals: string[] = [];
  let malicious = false;
  let suspicious = false;
  if (rep.feodo) { malicious = true; signals.push(`Botnet C2 (${rep.feodo.malware})`); }
  if (rep.spamhaus) { malicious = true; signals.push(`Spamhaus DROP (${rep.spamhaus.sblid})`); }
  if (rep.greynoise?.classification === 'malicious') { malicious = true; signals.push('GreyNoise: malicious scanner'); }
  if (rep.greynoise?.classification === 'benign' || rep.greynoise?.riot) signals.push('GreyNoise: known benign service');
  if (rep.tor_exit) { suspicious = true; signals.push('Tor exit node'); }
  if (rep.greynoise?.noise && rep.greynoise.classification !== 'benign' && rep.greynoise.classification !== 'malicious') {
    suspicious = true; signals.push('Observed scanning the internet');
  }
  if (rep.otx && rep.otx.pulse_count > 0 && !rep.otx.whitelisted) {
    if (rep.otx.pulse_count > 5) suspicious = true;
    signals.push(`Named in ${rep.otx.pulse_count} OTX report${rep.otx.pulse_count === 1 ? '' : 's'}`);
  }

  rep.signals = signals;
  rep.verdict = malicious ? 'malicious'
    : suspicious ? 'suspicious'
    : (rep.greynoise || rep.otx || rep.tor_exit != null) ? 'clean'
    : 'unknown';
  return rep;
}
