import type { ApiGroup } from '../../api-catalog';
import { ACCOUNT } from './osint';

export const RECON_SCAN: ApiGroup = {
  id: 'recon-scan',
  title: 'Recon scanners',
  blurb: 'Active and web-facing probes the web tier runs itself, keylessly. Each needs an account, like the rest of the OSINT toolkit. Port scans and vulnerability checks share the 30-an-hour scan allowance with the subnet sweep; TLS, headers, tech and subdomains count as ordinary lookups. Targets are validated against private and reserved ranges before any connection.',
  endpoints: [
    {
      path: '/api/osint/portscan',
      method: 'GET',
      headers: ACCOUNT,
      summary: 'Live TCP-connect scan of the common ports. Only scan hosts you are authorised to test.',
      params: [{ name: 'target', required: true, desc: 'Host or IP to scan.', example: 'scanme.nmap.org' }],
      returns: ['host', 'address', 'ports', 'scanned', 'duration'],
    },
    {
      path: '/api/osint/tls',
      method: 'GET',
      headers: ACCOUNT,
      summary: 'Opens a TLS handshake and reports the negotiated protocol, cipher and leaf certificate.',
      params: [{ name: 'domain', required: true, desc: 'Host to connect to, optionally with :port.', example: 'wikipedia.org' }],
      returns: ['protocol', 'cipher', 'authorized', 'valid', 'issuer', 'subject', 'expires', 'days_left', 'sans'],
    },
    {
      path: '/api/osint/headers',
      method: 'GET',
      headers: ACCOUNT,
      summary: 'Grades a site on its protective response headers.',
      params: [{ name: 'url', required: true, desc: 'Site to check.', example: 'https://wikipedia.org' }],
      returns: ['status', 'final_url', 'headers', 'security'],
    },
    {
      path: '/api/osint/tech',
      method: 'GET',
      headers: ACCOUNT,
      summary: 'Fingerprints a site from what it actually emits — headers, cookies and markup.',
      params: [{ name: 'url', required: true, desc: 'Site to fingerprint.', example: 'https://wikipedia.org' }],
      returns: ['technologies', 'server', 'powered_by', 'final_url'],
    },
    {
      path: '/api/osint/subdomains',
      method: 'GET',
      headers: ACCOUNT,
      summary: 'Enumerates subdomains from crt.sh, certspotter and hackertarget, merged.',
      params: [{ name: 'domain', required: true, desc: 'Apex domain.', example: 'wikipedia.org' }],
      returns: ['subdomains', 'total', 'sources'],
    },
    {
      path: '/api/osint/vuln',
      method: 'GET',
      headers: ACCOUNT,
      summary: 'Resolves a host and scores its recorded CVEs with CVSS, EPSS and CISA KEV.',
      params: [{ name: 'target', required: true, desc: 'Host or IP.', example: 'scanme.nmap.org' }],
      returns: ['ip', 'software', 'vulnerabilities', 'total', 'counts', 'risk_level', 'truncated'],
    },
  ],
};
