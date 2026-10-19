import type { ApiGroup } from '../../api-catalog';
import { msg } from '@/lib/core/i18n/translator';

export const SYSTEM: ApiGroup = {
  id: 'system',
  title: msg('System status'),
  blurb:
    'Liveness and aggregate counters. Safe to poll from monitoring. The accounts API behind /api/v1 (keys, usage, workspaces, ArcGIS, the entity graph) documents itself at /api/v1/docs.',
  endpoints: [
    {
      path: '/api/health',
      method: 'GET',
      summary: 'Liveness probe. Never touches an upstream feed, so it stays fast under load.',
      returns: ['status', 'scope', 'checks_performed', 'detail', 'platform', 'version', 'uptime_seconds', 'nominatim', 'timestamp'],
      notes:
        '`status` is the literal string `serving`: it reports the process, not the feeds. `nominatim` counts what this process has asked of the OpenStreetMap geocoder (`sent` against `served`, `fromCache`, `failed`, `refused`), so its one-request-a-second rule can be watched.',
    },
    {
      path: '/api/stats',
      method: 'GET',
      summary:
        'Fans out to the heavy feeds in parallel and returns only the counts — roughly 100 bytes instead of 10 MB of GeoJSON.',
      returns: ['stats', 'timestamp'],
      notes:
        '`stats` contains `flights`, `sats`, `cctv`, `weather`, `nuclear`, `incidents`. Cached `s-maxage=30, stale-while-revalidate=60`, so 10k concurrent dashboard boots collapse into one upstream fetch per minute.',
    },
  ],
};
