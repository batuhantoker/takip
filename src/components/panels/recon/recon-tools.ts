import {
  Radar, Globe, Shield, FileText, AlertTriangle, Server,
  Lock, Bug, Code, Layers, Network, Fingerprint, Crosshair,
  Bitcoin, Phone, Terminal, ShieldAlert, User, Cpu, ScanSearch,
} from 'lucide-react';
import type { IconType } from '@/components/ui/class-names';
import DigitalDonMark from '@/components/panels/markets/digital-don-mark';
import { msg, type Translate } from '@/lib/core/i18n/translator';

/** Grouped by what you are looking into, so the list reads as a few short lists rather than one long one. */
export const GROUPS = [
  { id: 'network', label: msg('Network') },
  { id: 'domain', label: msg('Domains and websites') },
  { id: 'identity', label: msg('People and accounts') },
  { id: 'threat', label: msg('Threats and leaks') },
  { id: 'chain', label: msg('Crypto') },
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
  { id: 'bgp', label: msg('Network owner'), icon: Globe, placeholder: msg('IP address or ASN, like AS15169'), group: 'network', blurb: msg('Who runs the network behind an IP or ASN'), aliases: 'bgp asn route prefix', example: '8.8.8.8' },
  { id: 'shodan', label: msg('Exposed services'), icon: Network, placeholder: msg('IP address'), group: 'network', blurb: msg('What Shodan has seen open on an IP'), aliases: 'shodan iot internetdb', example: '1.1.1.1' },
  { id: 'scanner', label: msg('Port scan'), icon: Radar, placeholder: msg('IP address or hostname'), group: 'network', blurb: msg('Open ports and the services behind them'), verb: msg('Scan'), aliases: 'ports nmap', example: 'scanme.nmap.org', note: msg('A live TCP-connect scan of the common ports, run from our server. Only scan hosts you’re allowed to test.') },
  { id: 'vuln', label: msg('Known vulnerabilities'), icon: Bug, placeholder: msg('IP address or hostname'), group: 'network', blurb: msg('Published CVEs for the software a host runs'), verb: msg('Check'), aliases: 'cve vuln', example: 'scanme.nmap.org', note: msg('Reads the host’s recorded CVEs and scores each one; can take up to a minute.') },
  { id: 'mac', label: msg('MAC vendor'), icon: Cpu, placeholder: msg('MAC address, like 00:1A:2B:3C:4D:5E'), group: 'network', blurb: msg('Who made a network card, from its MAC address'), aliases: 'mac hardware oui', example: 'F0:18:98:4A:2B:1C' },
  { id: 'sweep', label: msg('Scan a subnet'), icon: Crosshair, placeholder: msg('IPv4 address, like 8.8.8.8'), group: 'network', blurb: msg('Exposed devices near an IP, plotted on the map'), verb: msg('Scan'), aliases: 'sweep subnet cidr', example: '45.33.32.156', note: msg('Reads Shodan’s records for every address in the block. Nothing is sent to the devices themselves.') },

  { id: 'dns', label: msg('DNS records'), icon: Server, placeholder: msg('Domain, like example.com'), group: 'domain', blurb: msg('A, MX, NS, TXT and the rest'), aliases: 'dns records mx', example: 'wikipedia.org' },
  { id: 'whois', label: msg('Who owns this domain'), icon: FileText, placeholder: msg('Domain, like example.com'), group: 'domain', blurb: msg('Registrar, dates and name servers'), aliases: 'whois registrar owner', example: 'wikipedia.org' },
  { id: 'certs', label: msg('Certificates'), icon: Lock, placeholder: msg('Domain, like example.com'), group: 'domain', blurb: msg('Every certificate logged for a domain'), aliases: 'certs crt ct transparency', example: 'wikipedia.org' },
  { id: 'ssl', label: msg('TLS check'), icon: Shield, placeholder: msg('Domain, like example.com'), group: 'domain', blurb: msg('Protocol, cipher and certificate health'), verb: msg('Check'), aliases: 'ssl tls https cipher', example: 'wikipedia.org' },
  { id: 'subdomains', label: msg('Subdomains'), icon: Layers, placeholder: msg('Domain, like example.com'), group: 'domain', blurb: msg('Hostnames found under a domain'), aliases: 'subdomains hosts', example: 'wikipedia.org' },
  { id: 'headers', label: msg('Security headers'), icon: Code, placeholder: msg('Website, like https://example.com'), group: 'domain', blurb: msg('Which protective HTTP headers a site sends'), verb: msg('Check'), aliases: 'headers http csp hsts', example: 'https://wikipedia.org' },
  { id: 'tech', label: msg('Tech stack'), icon: ScanSearch, placeholder: msg('Website, like https://example.com'), group: 'domain', blurb: msg('Frameworks and services a site is built on'), aliases: 'tech stack framework cms', example: 'https://wordpress.org' },

  { id: 'fingerprint', label: msg('Profile search'), icon: Fingerprint, placeholder: msg('Username, email or phone'), group: 'identity', blurb: msg('Public profiles for a username, email or phone'), verb: msg('Search'), aliases: 'fingerprint profiles accounts' },
  { id: 'username', label: msg('Username check'), icon: User, placeholder: msg('Username'), group: 'identity', blurb: msg('The best-known sites, answered in one go'), verb: msg('Check'), aliases: 'username handle', example: 'octocat' },
  { id: 'github', label: msg('GitHub profile'), icon: Terminal, placeholder: msg('GitHub username'), group: 'identity', blurb: msg('Public profile and recent repositories'), aliases: 'github git repos', example: 'octocat' },
  { id: 'phone', label: msg('Phone number'), icon: Phone, placeholder: msg('Phone number with country code, like +44…'), group: 'identity', blurb: msg('Country, format and line type'), aliases: 'phone number carrier', example: '+44 20 7946 0958' },

  { id: 'threats', label: msg('Reputation'), icon: AlertTriangle, placeholder: msg('IP address or domain'), group: 'threat', blurb: msg('Threat reports and Tor exits for an IP or domain'), verb: msg('Check'), aliases: 'threats reputation malware otx tor', example: '1.1.1.1' },
  { id: 'leaks', label: msg('Data breaches'), icon: ShieldAlert, placeholder: msg('Email address'), group: 'threat', blurb: msg('Known breaches that include an email address'), verb: msg('Check'), aliases: 'leaks breach pwned' },

  { id: 'crypto', label: msg('Crypto wallets'), icon: Bitcoin, placeholder: msg('BTC, ETH or SOL address'), group: 'chain', blurb: msg('Trace a wallet, or read today’s exploits brief'), aliases: 'crypto wallet bitcoin ethereum solana chain', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
  // DigitalDon's own mark, kept monochrome by their brand rule.
  { id: 'donbot', label: msg('Token scan'), icon: DigitalDonMark, placeholder: msg('Ticker, name or contract address'), group: 'chain', blurb: msg('DigitalDon’s signal and holders for a token'), aliases: 'donbot token ticker' },
];

export const toolById = (id: string | null | undefined) => TABS.find(tool => tool.id === id);

/** Tools whose name, description or aliases contain every word of the filter, in English or the reader's language. */
export function matchTools(filter: string, tools: ToolDef[] = TABS, t?: Translate): ToolDef[] {
  const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return tools;
  return tools.filter(tool => {
    const hay = `${tool.label} ${tool.blurb} ${tool.id} ${tool.aliases ?? ''} ${t ? `${t(tool.label)} ${t(tool.blurb)}` : ''}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

/** The tools with their names in the reader's language beside the English, for matching what was typed. */
export const namedTools = (t: Translate) => TABS.map(tool => ({ ...tool, label: `${tool.label} ${t(tool.label)}` }));
