import {
  Radar, Globe, Shield, FileText, AlertTriangle, Server,
  Lock, Bug, Code, Layers, Network, Fingerprint, Crosshair,
  Bitcoin, Phone, Terminal, ShieldAlert, User, Cpu, ScanSearch,
} from 'lucide-react';
import type { IconType } from '@/components/ui/class-names';
import DigitalDonMark from '@/components/panels/markets/digital-don-mark';

/** Grouped by what you are looking into, so the list reads as a few short lists rather than one long one. */
export const GROUPS = [
  { id: 'network', label: 'Network' },
  { id: 'domain', label: 'Domains and websites' },
  { id: 'identity', label: 'People and accounts' },
  { id: 'threat', label: 'Threats and leaks' },
  { id: 'chain', label: 'Crypto' },
] as const;

type GroupId = (typeof GROUPS)[number]['id'];

export interface ToolDef {
  /** Keys the lookup route, sign-in rules and history; never rename. */
  id: string;
  label: string;
  icon: IconType;
  placeholder: string;
  group: GroupId;
  blurb: string;
  /** The run button's verb, when "Look up" is the wrong word. */
  verb?: string;
  /** Other words people search the list with. */
  aliases?: string;
  /** A safe, public target to try the tool on. */
  example?: string;
  /** What running it actually does, said before the first run. */
  note?: string;
}

export const TABS: ToolDef[] = [
  { id: 'bgp', label: 'Network owner', icon: Globe, placeholder: 'IP address or ASN, like AS15169', group: 'network', blurb: 'Who runs the network behind an IP or ASN', aliases: 'bgp asn route prefix', example: '8.8.8.8' },
  { id: 'shodan', label: 'Exposed services', icon: Network, placeholder: 'IP address', group: 'network', blurb: 'What Shodan has seen open on an IP', aliases: 'shodan iot internetdb', example: '1.1.1.1' },
  { id: 'scanner', label: 'Port scan', icon: Radar, placeholder: 'IP address or hostname', group: 'network', blurb: 'Open ports and the services behind them', verb: 'Scan', aliases: 'ports nmap', example: 'scanme.nmap.org', note: 'A live TCP-connect scan of the common ports, run from our server. Only scan hosts you’re allowed to test.' },
  { id: 'vuln', label: 'Known vulnerabilities', icon: Bug, placeholder: 'IP address or hostname', group: 'network', blurb: 'Published CVEs for the software a host runs', verb: 'Check', aliases: 'cve vuln', example: 'scanme.nmap.org', note: 'Reads the host’s recorded CVEs and scores each one; can take up to a minute.' },
  { id: 'mac', label: 'MAC vendor', icon: Cpu, placeholder: 'MAC address, like 00:1A:2B:3C:4D:5E', group: 'network', blurb: 'Who made a network card, from its MAC address', aliases: 'mac hardware oui', example: 'F0:18:98:4A:2B:1C' },
  { id: 'sweep', label: 'Scan a subnet', icon: Crosshair, placeholder: 'IPv4 address, like 8.8.8.8', group: 'network', blurb: 'Exposed devices near an IP, plotted on the map', verb: 'Scan', aliases: 'sweep subnet cidr', example: '45.33.32.156', note: 'Reads Shodan’s records for every address in the block. Nothing is sent to the devices themselves.' },

  { id: 'dns', label: 'DNS records', icon: Server, placeholder: 'Domain, like example.com', group: 'domain', blurb: 'A, MX, NS, TXT and the rest', aliases: 'dns records mx', example: 'wikipedia.org' },
  { id: 'whois', label: 'Who owns this domain', icon: FileText, placeholder: 'Domain, like example.com', group: 'domain', blurb: 'Registrar, dates and name servers', aliases: 'whois registrar owner', example: 'wikipedia.org' },
  { id: 'certs', label: 'Certificates', icon: Lock, placeholder: 'Domain, like example.com', group: 'domain', blurb: 'Every certificate logged for a domain', aliases: 'certs crt ct transparency', example: 'wikipedia.org' },
  { id: 'ssl', label: 'TLS check', icon: Shield, placeholder: 'Domain, like example.com', group: 'domain', blurb: 'Protocol, cipher and certificate health', verb: 'Check', aliases: 'ssl tls https cipher', example: 'wikipedia.org' },
  { id: 'subdomains', label: 'Subdomains', icon: Layers, placeholder: 'Domain, like example.com', group: 'domain', blurb: 'Hostnames found under a domain', aliases: 'subdomains hosts', example: 'wikipedia.org' },
  { id: 'headers', label: 'Security headers', icon: Code, placeholder: 'Website, like https://example.com', group: 'domain', blurb: 'Which protective HTTP headers a site sends', verb: 'Check', aliases: 'headers http csp hsts', example: 'https://wikipedia.org' },
  { id: 'tech', label: 'Tech stack', icon: ScanSearch, placeholder: 'Website, like https://example.com', group: 'domain', blurb: 'Frameworks and services a site is built on', aliases: 'tech stack framework cms', example: 'https://wordpress.org' },

  { id: 'fingerprint', label: 'Profile search', icon: Fingerprint, placeholder: 'Username, email or phone', group: 'identity', blurb: 'Public profiles for a username, email or phone', verb: 'Search', aliases: 'fingerprint profiles accounts' },
  { id: 'username', label: 'Username check', icon: User, placeholder: 'Username', group: 'identity', blurb: 'The best-known sites, answered in one go', verb: 'Check', aliases: 'username handle', example: 'octocat' },
  { id: 'github', label: 'GitHub profile', icon: Terminal, placeholder: 'GitHub username', group: 'identity', blurb: 'Public profile and recent repositories', aliases: 'github git repos', example: 'octocat' },
  { id: 'phone', label: 'Phone number', icon: Phone, placeholder: 'Phone number with country code, like +44…', group: 'identity', blurb: 'Country, format and line type', aliases: 'phone number carrier', example: '+44 20 7946 0958' },

  { id: 'threats', label: 'Reputation', icon: AlertTriangle, placeholder: 'IP address or domain', group: 'threat', blurb: 'Threat reports and Tor exits for an IP or domain', verb: 'Check', aliases: 'threats reputation malware otx tor', example: '1.1.1.1' },
  { id: 'leaks', label: 'Data breaches', icon: ShieldAlert, placeholder: 'Email address', group: 'threat', blurb: 'Known breaches that include an email address', verb: 'Check', aliases: 'leaks breach pwned' },

  { id: 'crypto', label: 'Crypto wallets', icon: Bitcoin, placeholder: 'BTC, ETH or SOL address', group: 'chain', blurb: 'Trace a wallet, or read today’s exploits brief', aliases: 'crypto wallet bitcoin ethereum solana chain', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
  // DigitalDon's own mark, kept monochrome by their brand rule.
  { id: 'donbot', label: 'Token scan', icon: DigitalDonMark, placeholder: 'Ticker, name or contract address', group: 'chain', blurb: 'DigitalDon’s signal and holders for a token', aliases: 'donbot token ticker' },
];

export const toolById = (id: string | null | undefined) => TABS.find(t => t.id === id);

/** Tools whose name, description or aliases contain every word of the filter. */
export function matchTools(filter: string, tools: ToolDef[] = TABS): ToolDef[] {
  const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return tools;
  return tools.filter(t => {
    const hay = `${t.label} ${t.blurb} ${t.id} ${t.aliases ?? ''}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}
