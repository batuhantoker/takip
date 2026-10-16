import type { ApiGroup } from '../../api-catalog';

export const CYBER: ApiGroup = {
  id: 'cyber',
  title: 'Cyber threats',
  blurb: 'Vulnerability, attack, malware, and on-chain threat telemetry.',
  endpoints: [
    {
      path: '/api/cyber-threats',
      method: 'GET',
      summary: 'Vulnerabilities CISA added to its Known Exploited Vulnerabilities list in the last 30 days (up to 10), with rollup statistics.',
      returns: ['threats', 'stats', 'timestamp'],
    },
    {
      path: '/api/cyber-attacks',
      method: 'GET',
      summary: 'Listed botnet C2 servers from abuse.ch Feodo Tracker — blocklist entries, not observed attacks.',
      returns: ['indicators', 'total', 'online', 'fetched_at', 'source', 'source_url'],
    },
    {
      path: '/api/malware',
      method: 'GET',
      summary: 'Live malware hosts from abuse.ch URLhaus, geolocated per address.',
      returns: ['threats', 'total', 'cursor', 'last_poll', 'stream', 'source', 'timestamp'],
    },
    {
      path: '/api/malware/stream',
      method: 'GET',
      summary:
        'Server-sent events for the malware layer: a snapshot on connect, then new detections as URLhaus reports them.',
      returns: ['snapshot', 'detections', 'status', 'heartbeat'],
    },
    {
      path: '/api/chain/daily',
      method: 'GET',
      summary: 'Daily chain-threat brief: on-chain exploits (DefiLlama), crypto and blockchain CVEs (NVD) and newly designated OFAC wallets.',
      params: [
        { name: 'days', desc: 'Window in days, 1 to 120. Defaults to 30.', example: '30' },
        { name: 'refresh', desc: '`1` rebuilds the brief instead of reading the cached one.' },
      ],
      returns: ['generated_at', 'window_days', 'exploits', 'cves', 'sanctioned_wallets', 'totals', 'degraded', 'sources'],
      notes: 'Keyless. A section that fails is named in `degraded` and the rest still answer. 30 requests a minute per address.',
    },
  ],
};
