import type { ApiGroup } from '../../api-catalog';
import { msg } from '@/lib/core/i18n/translator';

export const INTERNET: ApiGroup = {
  id: 'internet',
  title: msg('Internet and services'),
  blurb: 'Connectivity outages, attack origins, and the status pages of major vendors.',
  endpoints: [
    {
      path: '/api/radar',
      method: 'GET',
      summary: 'Internet outage signals by country from IODA (Georgia Tech): drops that began in the last 48 hours, one per country.',
      returns: ['outages', 'total', 'window_hours', 'source', 'timestamp'],
    },
    {
      path: '/api/cloudflare-radar',
      method: 'GET',
      summary: 'Internet outages from Cloudflare Radar, confirmed ones and its detector’s traffic drops, by country and network, with the top layer-3 attack origins.',
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
