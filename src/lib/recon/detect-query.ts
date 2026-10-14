import { isValidUsername } from './sherlock';

export type QueryKind = 'ipv4' | 'ipv6' | 'mac' | 'asn' | 'domain' | 'url' | 'email' | 'phone' | 'cve' | 'wallet' | 'hash' | 'username' | 'unknown';

export interface Detection {
  kind: QueryKind;
  /** "Looks like a domain" — shown under the search field. */
  label: string;
  /** Tool ids worth offering, best first. Enter runs the first. Empty when we can tell what it is but nothing here looks it up. */
  tools: string[];
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-f:]+:[0-9a-f:]*$/i;
const MAC = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;
const ASN = /^as\d+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CVE = /^cve-\d{4}-\d{3,}$/i;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const HEX_HASH = /^(0x)?[0-9a-f]{32,128}$/i;
const BTC = /^(bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const isIpv4 = (q: string) => { const m = q.match(IPV4); return !!m && m.slice(1).every(n => +n <= 255); };
const digitsOf = (q: string) => q.replace(/\D/g, '');
const looksPhone = (q: string) => /^\+?[\d\s().-]{6,}$/.test(q) && digitsOf(q).length >= 7 && digitsOf(q).length <= 15;

/** Guess what someone typed, so the right tools can be offered under the field. Order matters where patterns overlap. */
export function detectQuery(raw: string): Detection {
  const q = raw.trim();
  if (!q) return { kind: 'unknown', label: '', tools: [] };

  if (MAC.test(q)) return { kind: 'mac', label: 'Looks like a MAC address', tools: ['mac'] };
  if (EMAIL.test(q)) return { kind: 'email', label: 'Looks like an email address', tools: ['leaks', 'fingerprint'] };
  if (CVE.test(q)) return { kind: 'cve', label: 'Looks like a CVE id', tools: [] };
  if (ASN.test(q)) return { kind: 'asn', label: 'Looks like an ASN', tools: ['bgp'] };
  if (isIpv4(q)) return { kind: 'ipv4', label: 'Looks like an IP address', tools: ['bgp', 'shodan', 'scanner', 'vuln', 'threats', 'sweep'] };
  if (IPV6.test(q) && (q.match(/:/g)?.length ?? 0) >= 2) return { kind: 'ipv6', label: 'Looks like an IPv6 address', tools: ['bgp', 'shodan'] };

  if (/^https?:\/\//i.test(q)) return { kind: 'url', label: 'Looks like a web address', tools: ['headers', 'tech', 'ssl'] };
  if (DOMAIN.test(q)) return { kind: 'domain', label: 'Looks like a domain', tools: ['dns', 'whois', 'certs', 'subdomains', 'ssl', 'headers', 'tech', 'scanner', 'vuln'] };

  if (looksPhone(q)) return { kind: 'phone', label: 'Looks like a phone number', tools: ['phone', 'fingerprint'] };

  if (BTC.test(q) || (SOL.test(q) && q.length >= 40) || /^0x[0-9a-f]{40}$/i.test(q)) {
    return { kind: 'wallet', label: 'Looks like a crypto wallet', tools: ['crypto'] };
  }
  if (HEX_HASH.test(q)) return { kind: 'hash', label: 'Looks like a file hash', tools: [] };

  if (isValidUsername(q)) return { kind: 'username', label: 'Looks like a username', tools: ['fingerprint', 'username', 'github'] };
  return { kind: 'unknown', label: '', tools: [] };
}
