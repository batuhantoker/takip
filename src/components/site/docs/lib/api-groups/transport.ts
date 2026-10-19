import type { ApiGroup } from '../../api-catalog';
import { msg } from '@/lib/core/i18n/translator';

export const TRANSPORT: ApiGroup = {
  id: 'transport',
  title: msg('Roads, rail and sea'),
  blurb: 'Measured road traffic, live public transport, shipping, chokepoints, and maritime warnings.',
  endpoints: [
    {
      path: '/api/traffic',
      method: 'GET',
      summary: 'Measured road traffic in a city-sized box: the segments running slower than usual or reported congested (NDW, Rennes, Nantes).',
      params: [{ name: 'bbox', required: true, desc: '`minLng,minLat,maxLng,maxLat`, at most 3° by 2°; wider boxes return `tooWide`.' }],
      returns: ['segments', 'sources', 'flow', 'tooWide', 'timestamp'],
      notes: 'Free-flowing roads are left out. NDW gives a percentage of the usual speed; the cities give their own traffic class. Each provider is read only for boxes it covers, at most every 90 s (NDW) or 4 min. `flow` says whether `/api/traffic/flow` has a TomTom key behind it.',
    },
    {
      path: '/api/traffic/flow/{z}/{x}/{y}',
      method: 'GET',
      summary: 'One TomTom traffic flow vector tile (Mapbox Vector Tile, layer `Traffic flow`), up to zoom 15: every road TomTom measures, worldwide.',
      returns: ['application/x-protobuf', '204 when there is no key, the daily cap is reached or TomTom fails'],
      env: ['TOMTOM_API_KEY'],
      notes: '`traffic_level` is the current speed over the free-flow speed (0–1); `road_closure`, `traffic_road_coverage`, `left_hand_traffic` and `road_type` come with it. Tiles are shared for 2 min, with at most 6,000 upstream tiles a day.',
    },
    {
      path: '/api/transit',
      method: 'GET',
      summary: 'Live buses, trams and trains in a city-sized box, from public GTFS-RT feeds and İETT.',
      params: [{ name: 'bbox', required: true, desc: '`minLng,minLat,maxLng,maxLat`, at most 3° by 2°; wider boxes return `tooWide`.' }],
      returns: ['feeds', 'vehicles', 'skipped', 'tooWide', 'timestamp'],
      notes: 'Takes a box, never a feed URL: only feeds in the TAKIP catalogue whose area meets the box, at most 8 per call. Each feed is fetched at most every 15 s.',
    },
    {
      path: '/api/transit/shape',
      method: 'GET',
      summary: "The shape a vehicle's trip runs along, from its feed's static GTFS, so a tracked vehicle moves along its route.",
      params: [
        { name: 'feed', required: true, desc: 'Feed id, the part of a vehicle key before the first colon.' },
        { name: 'trip', desc: 'The vehicle\'s trip id from /api/transit.' },
      ],
      returns: ['shape', 'road'],
      notes: '`road` is true when every route of the feed runs on the road, so /api/transit/path is the fallback.',
    },
    {
      path: '/api/transit/path',
      method: 'GET',
      summary: 'The roads a bus took between two fixes, for road-only feeds without shapes (OSRM driving route).',
      params: [
        { name: 'feed', required: true, desc: 'A road-only feed id.' },
        { name: 'from', required: true, desc: '`lng,lat`' },
        { name: 'to', required: true, desc: '`lng,lat`, 25 m to 5 km away.' },
      ],
      returns: ['path'],
      notes: 'At most one OSRM call a second across all callers, as the public demo asks; a route much longer than the hop returns null.',
    },
    {
      path: '/api/maritime',
      method: 'GET',
      summary: 'Ports, chokepoints, and vessel positions.',
      returns: ['ports', 'chokepoints', 'ships', 'total_ports', 'total_chokepoints', 'total_ships', 'timestamp'],
      env: ['AIS_API_KEY'],
      notes: 'Vessels come from the aisstream.io websocket, so without the key `ships` is empty. Port congestion and chokepoint risk are heuristics over the ships nearby.',
    },
    {
      path: '/api/chokepoints',
      method: 'GET',
      summary: "Transits through strategic chokepoints from IMF PortWatch, rated against each one's recent baseline, with open and recently ended disruptions.",
      returns: ['chokepoints', 'disruptions', 'timestamp'],
      notes: 'PortWatch updates weekly. Read every 6 hours; when it fails, the last answer is served for a day with `stale: true`.',
    },
    {
      path: '/api/nav-warnings',
      method: 'GET',
      summary: 'NGA MSI broadcast navigational warnings, placed on the map.',
      returns: ['warnings', 'total', 'unplaced', 'latestIssued', 'stale', 'timestamp'],
      notes: '`unplaced` counts warnings in force whose text gives no position. NGA stopped issuing through this API in May 2024, so `stale` is true once the newest warning is over 30 days old.',
    },
  ],
};
