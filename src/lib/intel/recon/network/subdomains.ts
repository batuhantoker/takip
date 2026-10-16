export interface SubdomainReport {
  domain: string;
  subdomains: string[];
  total: number;
  sources: { name: string; ok: boolean; found: number }[];
}

const UA = { 'User-Agent': 'Mozilla/5.0 TAKIP-Recon', Accept: 'application/json, text/plain, */*' };

const clean = (name: string, domain: string): string | null => {
  const n = name.trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
  if (!n || n.includes(' ') || n.includes('*')) return null;
  return n.endsWith(`.${domain}`) ? n : null;
};

/** crt.sh — certificate transparency. Often busy; it is one source of three. */
async function fromCrtsh(domain: string, signal: AbortSignal): Promise<string[]> {
  const res = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`, { signal, headers: UA });
  if (!res.ok) throw new Error(`crt.sh ${res.status}`);
  const rows: { name_value?: string }[] = await res.json();
  return rows.flatMap(r => (r.name_value ?? '').split('\n'));
}

/** certspotter — a second CT log view, with a different availability profile. Terms: small keyless quota per address. */
async function fromCertspotter(domain: string, signal: AbortSignal): Promise<string[]> {
  const url = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`;
  const res = await fetch(url, { signal, headers: UA });
  if (!res.ok) throw new Error(`certspotter ${res.status}`);
  const rows: { dns_names?: string[] }[] = await res.json();
  return rows.flatMap(r => r.dns_names ?? []);
}

/** hackertarget — passive DNS, so it catches hosts that never got a public cert. Terms: free tier, about 50 queries a day per address. */
async function fromHackertarget(domain: string, signal: AbortSignal): Promise<string[]> {
  const res = await fetch(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(domain)}`, { signal, headers: UA });
  const text = await res.text();
  if (!res.ok || /error|API count exceeded/i.test(text)) throw new Error(`hackertarget ${res.status}`);
  return text.split('\n').map(line => line.split(',')[0]);
}

const SOURCES: [string, (d: string, s: AbortSignal) => Promise<string[]>][] = [
  ['crt.sh', fromCrtsh],
  ['certspotter', fromCertspotter],
  ['hackertarget', fromHackertarget],
];

/**
 * Enumerate a domain's subdomains from three independent public sources and
 * merge them. No single source is reliable — crt.sh frequently 502s — so the
 * union is what makes this dependable, and each source's contribution is
 * reported so a reader sees what answered.
 */
export async function enumerateSubdomains(domain: string, timeoutMs = 12_000): Promise<SubdomainReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const all = new Set<string>();
  const sources: SubdomainReport['sources'] = [];

  try {
    const settled = await Promise.allSettled(SOURCES.map(([, fn]) => fn(domain, controller.signal)));
    settled.forEach((outcome, i) => {
      const name = SOURCES[i][0];
      if (outcome.status === 'fulfilled') {
        const cleaned = outcome.value.map(n => clean(n, domain)).filter((n): n is string => n !== null);
        cleaned.forEach(n => all.add(n));
        sources.push({ name, ok: true, found: new Set(cleaned).size });
      } else {
        sources.push({ name, ok: false, found: 0 });
      }
    });
  } finally {
    clearTimeout(timer);
  }

  return { domain, subdomains: [...all].sort(), total: all.size, sources };
}
