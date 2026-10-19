import type { ApiGroup } from '../../api-catalog';
import { msg } from '@/lib/core/i18n/translator';

export const AVIATION_SPACE: ApiGroup = {
  id: 'aviation-space',
  title: msg('Aviation and space weather'),
  blurb: 'Aircraft, airports, aviation weather, orbital objects, and heliophysics.',
  endpoints: [
    {
      path: '/api/flights',
      method: 'GET',
      summary: 'Live ADS-B aircraft, bucketed by class, with GPS interference cells.',
      returns: [
        'commercial_flights',
        'private_flights',
        'private_jets',
        'military_flights',
        'gps_jamming',
        'total',
        'source',
        'providers',
        'timestamp',
      ],
      env: ['OPENSKY_CLIENT_ID', 'OPENSKY_CLIENT_SECRET'],
      notes:
        'Keyless via adsb.lol and adsb.fi, with OpenSky as a further source. Each bucket is an array; `total` counts them all. `gps_jamming` holds cells where aircraft report degraded navigation accuracy. `providers` gives per-feed counts, so a feed that answers with no aircraft is visible. OpenSky credentials lift its anonymous budget of 400 credits a day; they are not required.',
    },
    {
      path: '/api/flights/nearby',
      method: 'GET',
      summary: 'Aircraft within 250 nm of a point, a few seconds old, from adsb.lol.',
      params: [
        { name: 'lat', required: true, desc: 'Latitude of the point.', example: '51.5' },
        { name: 'lon', required: true, desc: 'Longitude of the point.', example: '-0.1' },
      ],
      returns: ['anchor', 'radius_nm', 'flights', 'at', 'stale'],
      notes: 'The point snaps to a 0.25° grid, so nearby asks share one read; each is held 12 s. Rows have the `/api/flights` shape plus `emergency` when the transponder sends an ADS-B emergency status. `stale` is true when adsb.lol is busy and the last read is served instead.',
    },
    {
      path: '/api/airport-status',
      method: 'GET',
      summary: 'US airport delay programmes, ground stops and closures from FAA NAS Status.',
      returns: ['airports', 'unplaced', 'updated', 'timestamp'],
      notes:
        'An empty `airports` is the normal answer. `unplaced` holds delays at airports with no known position. Read at most every 2 minutes; when the FAA fails, the last answer is served for 15 minutes with `stale: true`.',
    },
    {
      path: '/api/aviation-weather',
      method: 'GET',
      summary: "Aviation weather from aviationweather.gov: every station's latest METAR with its flight category, or the international SIGMETs in force.",
      params: [{ name: 'kind', required: true, desc: 'Which product to read.', example: 'airports | sigmets' }],
      returns: ['airports', 'updated', 'sigmets', 'timestamp'],
      notes: '`kind=airports` returns `airports` and `updated`; `kind=sigmets` returns `sigmets`, with expired ones dropped. Each product is read at most every 5 minutes.',
    },
    {
      path: '/api/satellites',
      method: 'GET',
      summary: 'Tracked orbital objects with TLE-derived positions.',
      returns: ['satellites', 'total', 'category_counts', 'source', 'raw_count', 'timestamp'],
      notes: 'TLEs from celestrak.org, with SatNOGS as the fallback; `source` says which answered. `category_counts` breaks the set down by mission type.',
    },
    {
      path: '/api/space-weather',
      method: 'GET',
      summary: 'Geomagnetic conditions and solar flare activity from NOAA SWPC.',
      returns: [
        'kp_index',
        'kp_available',
        'kp_timestamp',
        'storm_level',
        'storm_color',
        'solar_flares',
        'alerts',
        'scales',
        'timestamp',
      ],
      notes:
        '`storm_color` is a hex string the HUD renders directly, so clients need no severity lookup table. `kp_index` is null and `storm_level` is "Unknown" when NOAA did not answer — absence of a reading is never reported as "Quiet". `scales` carries the NOAA R/S/G scales.',
    },
    {
      path: '/api/aurora',
      method: 'GET',
      summary: 'The aurora nowcast from NOAA SWPC OVATION, as probability cells.',
      returns: ['observed_at', 'forecast_at', 'cells', 'max_pct', 'total', 'timestamp'],
      notes: 'Each cell is `[lng, lat, probability %]`, kept only at or above the floor the map draws. SWPC refreshes it about every 5 minutes.',
    },
  ],
};
