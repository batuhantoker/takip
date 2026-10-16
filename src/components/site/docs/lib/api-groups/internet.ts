import type { ApiGroup } from '../../api-catalog';

export const INTERNET: ApiGroup = {
  id: 'internet',
  title: 'Internet and services',
  blurb: 'Connectivity outages, attack origins, and the status pages of major vendors.',
  endpoints: [
    {
      path: '/api/radar',
      method: 'GET',
      summary: 'Internet outages by country from IODA (Georgia Tech).',
      returns: ['outages', 'total', 'source', 'timestamp'],
    },
    {
      path: '/api/cloudflare-radar',
      method: 'GET',
      summary: 'Internet outages and the top layer-3 attack origins from Cloudflare Radar.',
      params: [{ name: 'probe', desc: '`1` only reports whether a token is configured, without calling Cloudflare.', example: '1' }],
      returns: ['configured', 'outages', 'attack_origins', 'total_outages', 'total_attack_origins', 'source', 'timestamp'],
      env: ['CLOUDFLARE_API_TOKEN'],
      notes: 'Fails closed: 503 with `configured: false` while the token is unset. A section that fails leaves `partial: true` and its reason in `errors`; the token never appears in a response.',
    },
    {
      path: '/api/service-status',
      method: 'GET',
      summary: 'The status pages of major vendors (GitHub, Cloudflare, OpenAI, Datadog and more), read together every 5 minutes.',
      returns: ['vendors', 'unavailable', 'cities', 'timestamp'],
      notes: '`cities` groups degraded vendors by headquarters city, for the map; `unavailable` names the pages that did not answer.',
    },
  ],
};
