import {
  Radar, Globe, Shield, FileText, AlertTriangle, Server,
  Lock, Bug, Code, Layers, Network, Fingerprint, Crosshair,
  Bitcoin, Phone, Terminal, ShieldAlert, User
} from 'lucide-react';
import DigitalDonMark from '@/components/markets/digital-don-mark';

/**
 * Tool groups. At 19 modules a flat grid forces 8px truncated labels
 * ("SUBDOMA…", "PHONE I…"); grouping keeps every label readable and makes
 * the toolkit scannable by what you are investigating.
 */
export const GROUPS = [
  { id: 'network', label: 'NETWORK & HOST', hint: 'IPs, ports, routing, hardware' },
  { id: 'domain', label: 'DOMAIN & WEB', hint: 'DNS, certificates, site fingerprinting' },
  { id: 'identity', label: 'IDENTITY', hint: 'People, handles, accounts' },
  { id: 'threat', label: 'THREAT & EXPOSURE', hint: 'Reputation and breach data' },
  { id: 'chain', label: 'BLOCKCHAIN', hint: 'Wallets, tokens and on-chain incidents' },
] as const;

type GroupId = (typeof GROUPS)[number]['id'];

export interface ToolDef {
  id: string;
  label: string;
  icon: any;
  placeholder: string;
  color: string;
  group: GroupId;
  /** Shown under the label in the expanded view. */
  blurb: string;
}

export const TABS: ToolDef[] = [
  { id: 'scanner', label: 'PORT SCAN', icon: Radar, placeholder: 'IP or hostname', color: '#00E5FF', group: 'network', blurb: 'Open ports and running services' },
  { id: 'vuln', label: 'VULN SWEEP', icon: Bug, placeholder: 'IP or hostname', color: '#FF3D3D', group: 'network', blurb: 'Known CVEs affecting the host' },
  { id: 'shodan', label: 'SHODAN IOT', icon: Network, placeholder: 'IP address', color: '#FF3D3D', group: 'network', blurb: 'Internet-exposed device record' },
  { id: 'bgp', label: 'BGP ROUTE', icon: Globe, placeholder: 'IP or ASN', color: '#00E5FF', group: 'network', blurb: 'Autonomous system and prefixes' },
  { id: 'mac', label: 'MAC ADDR', icon: Fingerprint, placeholder: 'MAC address', color: '#FFD700', group: 'network', blurb: 'Hardware vendor lookup' },
  { id: 'sweep', label: 'IP SWEEP', icon: Crosshair, placeholder: 'Enter IP address (e.g. 8.8.8.8)', color: '#FF3D3D', group: 'network', blurb: 'Scan an entire subnet' },

  { id: 'dns', label: 'DNS', icon: Server, placeholder: 'Domain name', color: '#448AFF', group: 'domain', blurb: 'All record types' },
  { id: 'whois', label: 'WHOIS', icon: FileText, placeholder: 'Domain name', color: '#FFD700', group: 'domain', blurb: 'Registrar and ownership' },
  { id: 'certs', label: 'CERTS', icon: Lock, placeholder: 'Domain name', color: '#E040FB', group: 'domain', blurb: 'Certificate transparency log' },
  { id: 'ssl', label: 'SSL/TLS', icon: Shield, placeholder: 'Domain name', color: '#76FF03', group: 'domain', blurb: 'Cipher and certificate health' },
  { id: 'subdomains', label: 'SUBDOMAINS', icon: Layers, placeholder: 'Domain to enumerate', color: '#00BCD4', group: 'domain', blurb: 'Enumerate attack surface' },
  { id: 'headers', label: 'HEADERS', icon: Code, placeholder: 'URL to inspect', color: '#87CEEB', group: 'domain', blurb: 'Security headers audit' },
  { id: 'tech', label: 'TECH DETECT', icon: Code, placeholder: 'URL to fingerprint', color: '#9C27B0', group: 'domain', blurb: 'Frameworks and stack' },

  { id: 'username', label: 'USERNAME', icon: User, placeholder: 'Username / handle to hunt', color: '#00E676', group: 'identity', blurb: 'Hunt a handle across platforms' },
  { id: 'github', label: 'GITHUB RECON', icon: Terminal, placeholder: 'GitHub username', color: '#87CEEB', group: 'identity', blurb: 'Profile, repos and contacts' },
  { id: 'phone', label: 'PHONE INTEL', icon: Phone, placeholder: 'Phone number (e.g. +1...)', color: '#FF9500', group: 'identity', blurb: 'Carrier, region and line type' },
  { id: 'fingerprint', label: 'FINGERPRINT', icon: Fingerprint, placeholder: 'Username, email or phone', color: '#3B82F6', group: 'identity', blurb: 'Public profile search, streamed live' },

  { id: 'threats', label: 'THREATS', icon: AlertTriangle, placeholder: 'IP, domain, or hash', color: '#FF9500', group: 'threat', blurb: 'Reputation across feeds' },
  { id: 'leaks', label: 'DATA LEAKS', icon: ShieldAlert, placeholder: 'Email address', color: '#E040FB', group: 'threat', blurb: 'Breach exposure for an address' },

  { id: 'crypto', label: 'CHAIN INTEL', icon: Bitcoin, placeholder: 'BTC, ETH or SOL wallet address', color: '#F7931A', group: 'chain', blurb: 'Wallet forensics and daily brief' },
  // DigitalDon's own mark, kept monochrome by their brand rule.
  { id: 'donbot', label: 'DONBOT', icon: DigitalDonMark, placeholder: 'Ticker, name or contract address', color: '#E8E6E0', group: 'chain', blurb: 'Token signal and holder clusters' },
];
