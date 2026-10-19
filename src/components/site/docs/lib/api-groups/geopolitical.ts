import type { ApiGroup } from '../../api-catalog';
import { msg } from '@/lib/core/i18n/translator';

export const GEOPOLITICAL: ApiGroup = {
  id: 'geopolitical',
  title: msg('Geopolitical'),
  blurb: 'Conflict zones, frontlines, event streams, air-raid alerts, travel advice, and country-level risk.',
  endpoints: [
    {
      path: '/api/conflicts',
      method: 'GET',
      summary: 'Active conflict zones joined with live incident reporting.',
      returns: [
        'zones',
        'activeWarzones',
        'liveEvents',
        'totalZones',
        'totalLiveEvents',
        'sources',
        'refreshInterval',
        'timestamp',
      ],
      notes: '`refreshInterval` is the server’s recommended client poll interval in seconds — honour it rather than hard-coding your own. At most 500 `liveEvents` are returned; `totalLiveEvents` counts them all.',
    },
    {
      path: '/api/frontlines',
      method: 'GET',
      summary: 'Ukraine frontline geometry from DeepState Map.',
      returns: ['frontlines', 'timestamp'],
    },
    {
      path: '/api/gdelt-events',
      method: 'GET',
      summary: 'Geocoded world events from the GDELT 2.0 Events export, folded into stories.',
      params: [
        { name: 'family', desc: 'Comma-separated: violence, protest, tension, cooperation, or `all`. Defaults to violence,protest,tension.', example: 'violence,protest' },
        { name: 'min_reports', desc: 'Distinct headlines a story needs. Defaults to 2; 1 keeps single reports.', example: '2' },
        { name: 'hours', desc: 'Hours of exports to read, 1 to 6. Defaults to 2.', example: '2' },
        { name: 'limit', desc: 'Most stories to return, at most 2,000. Defaults to 600.', example: '600' },
      ],
      returns: ['events', 'total', 'stats', 'windows', 'source', 'timestamp'],
      notes: 'GDELT publishes a new export every 15 minutes.',
    },
    {
      path: '/api/war-alerts',
      method: 'GET',
      summary: 'Air-raid alerts: Israeli sirens by locality (Tzeva Adom) and Ukrainian air-raid state by oblast.',
      returns: ['alerts', 'total', 'active', 'sources', 'timestamp'],
      notes: 'A source that fails, or a Ukrainian mirror that has not refreshed in 10 minutes, is reported in `sources` rather than read as all-clear.',
    },
    {
      path: '/api/advisories',
      method: 'GET',
      summary: "Official travel advice per country on FCDO's 0–4 scale, from the US State Department, Smartraveller and the UK FCDO.",
      params: [{ name: 'iso2', desc: 'Two-letter ISO country code. Without it, every country from the US and Australian feeds.', example: 'UA' }],
      returns: ['advisories', 'unmatched', 'sources', 'timestamp'],
      notes: 'With `iso2` the answer adds `iso2` and the FCDO page, and drops `unmatched`. A failed issuer is reported in `sources`, never as a country with no warning.',
    },
    {
      path: '/api/country-risk',
      method: 'GET',
      summary: 'Per-country risk scoring alongside market session state.',
      returns: ['countries', 'methodology', 'exchanges', 'open_exchanges', 'total_exchanges', 'timestamp'],
      notes:
        '`base_risk` is a hand-assigned editorial ordering, not a calibrated or back-tested figure — `methodology.basis` says so on every response. `quake_magnitude` is the observed USGS component, reported separately so the two are not conflated.',
    },
    {
      path: '/api/region-dossier',
      method: 'GET',
      summary: 'Composite intelligence summary for a map location — the panel behind a map double right-click.',
      params: [
        { name: 'lat', required: true, desc: 'Latitude of the region.', example: '48.3794' },
        { name: 'lng', required: true, desc: 'Longitude of the region.', example: '31.1656' },
      ],
      returns: [
        'coordinates',
        'location',
        'country',
        'head_of_state',
        'wikipedia',
        'travel_advice',
        'displacement',
        'street_crime',
        'unavailable',
        'attribution',
        'timestamp',
      ],
      notes: '`unavailable` names the sources that did not answer (an advice issuer, UNHCR, data.police.uk), so their silence never reads as "no warning".',
    },
  ],
};
