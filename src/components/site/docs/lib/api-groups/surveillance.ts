import type { ApiGroup } from '../../api-catalog';
import { msg } from '@/lib/core/i18n/translator';

export const SURVEILLANCE: ApiGroup = {
  id: 'surveillance',
  title: msg('Surveillance and infrastructure'),
  blurb: 'Camera networks, fixed infrastructure, reference datasets, and stream and feature proxies.',
  endpoints: [
    {
      path: '/api/cctv',
      method: 'GET',
      summary: 'Public camera networks, by region.',
      params: [
        { name: 'region', desc: 'Comma-separated region ids, or `all`. Without any parameter, every region.', example: 'uk' },
        { name: 'lat', desc: 'With `lng`, loads the regions that cover this point.', example: '51.5072' },
        { name: 'lng', desc: 'With `lat`, loads the regions that cover this point.', example: '-0.1276' },
        { name: 'format', desc: '`pins` for positions only, as columns: `ids`, `source` (an index into `sources`), `lat` and `lng` as deltas in steps of 1e-5°, and `offline` (indexes). About a quarter of the full download; the map uses it.', example: 'pins' },
      ],
      returns: ['cameras', 'total', 'sources', 'regions', 'pendingRegions', 'timestamp'],
      notes:
        'The whole catalogue is served gzipped with an ETag. Some camera URLs point at TAKIP relays under /api/cctv/ (FAA, TxDOT, Seoul TOPIS, Traffic Scotland, İBB), which take a camera id rather than a URL.',
    },
    {
      path: '/api/cctv/details',
      method: 'GET',
      summary: 'Full records for cameras by id, as /api/cctv lists them.',
      params: [{ name: 'id', required: true, desc: 'A camera id; repeat it for more, up to 100. Repeated rather than comma-separated because some ids contain commas.', example: 'tfl-JamCams_00001.02151' }],
      returns: ['cameras'],
      notes: 'Ids the catalogue no longer holds are left out.',
    },
    {
      path: '/api/cctv/stream-status',
      method: 'GET',
      summary: 'Probes whether a camera stream is reachable before the player commits to it.',
      params: [{ name: 'url', required: true, desc: 'Stream URL to probe.' }],
      returns: ['available', 'blocked', 'provider', 'reason'],
      notes: '`blocked` distinguishes an upstream refusing our origin from a stream that is simply offline.',
    },
    {
      path: '/api/cctv/resolve',
      method: 'GET',
      summary: "Resolves a SkylineWebcams page or a YouTube channel's /live link to the stream on air now, so the viewer can embed it.",
      params: [{ name: 'url', required: true, desc: 'A SkylineWebcams page or a YouTube channel live link.' }],
      returns: ['embeddable', 'kind', 'videoId', 'embedUrl'],
      notes: '`kind` is `youtube` when there is something to embed; otherwise it says why, e.g. `missing`, `unreachable` or `unknown`. Only those two hosts are accepted.',
    },
    {
      path: '/api/cctv/proxy',
      method: 'GET',
      summary: 'Same-origin proxy for camera streams that set restrictive CORS headers.',
      params: [{ name: 'url', required: true, desc: 'Upstream stream URL.' }],
      returns: ['…the upstream body, as served'],
      notes: 'Allow-listed by domain: 403 for any other host, 502 when the upstream fails. Not a general-purpose open proxy.',
    },
    {
      path: '/api/cctv/frame',
      method: 'GET',
      summary: "A still camera's current frame, for the built-in detector (AI Analyze, TI Assist, forecasts).",
      params: [{ name: 'id', required: true, desc: 'Camera id from /api/cctv.' }],
      returns: ['image/jpeg | image/png | image/webp | image/gif', 'X-Frame-At header'],
      notes: 'Takes a camera id, never a URL: only cameras in the TAKIP catalogue. Frames are held for 4 s; 90 requests a minute per client.',
    },
    {
      path: '/api/infrastructure',
      method: 'GET',
      summary: 'Fixed strategic infrastructure — nuclear sites, plants, and facilities.',
      returns: ['infrastructure', 'total', 'timestamp'],
    },
    {
      path: '/api/reference',
      method: 'GET',
      summary: 'The static reference datasets and whether this server has each one installed.',
      returns: ['available', 'datasets'],
      notes: 'Each dataset has `id`, `label`, `group`, `geometry`, `minZoom`, `attribution`, `available`, `bytes`, `updated`. A server without the files reports `available: false`.',
    },
    {
      path: '/api/reference/{dataset}',
      method: 'GET',
      summary: "One reference dataset's features in a box, as GeoJSON.",
      params: [
        { name: 'bbox', desc: '`west,south,east,north`. Defaults to the whole world.', example: '-10,35,30,60' },
        { name: 'zoom', desc: "Map zoom, 0 to 24. Below the dataset's minZoom the collection is empty. Defaults to its minZoom." },
      ],
      returns: ['type', 'features', 'matched', 'truncated'],
      notes: 'At most 20,000 features; `truncated` says the cap was hit. Some datasets serve only their major features at low zoom. Sends an ETag; 503 when the dataset is not installed.',
    },
    {
      path: '/api/v1/arcgis',
      method: 'GET',
      summary: 'Searches ArcGIS Online for public Feature Services, or reads one layer as GeoJSON.',
      params: [
        { name: 'q', desc: 'Words to search the catalogue for. Wins over `service`.' },
        { name: 'service', desc: 'An https ArcGIS REST FeatureServer or MapServer URL on a host name, from a search result; a layer number is optional.' },
        { name: 'bbox', desc: 'Bounding box filter, `west,south,east,north` in degrees.' },
      ],
      returns: ['results', '…or a feature collection'],
      notes: 'Served by the accounts API (see /api/v1/docs). A layer read returns at most 2,000 features. Service reads are limited to 30 a minute per caller. IP literals, non-https URLs and hosts that resolve to private addresses are refused. Needs an API key unless /api/v1/key-policy lists it as open.',
    },
    {
      path: '/api/geo',
      method: 'GET',
      summary: 'Geolocates the calling client by IP, taking the place most of several providers agree on.',
      params: [
        { name: 'tz', desc: 'The caller’s IANA time zone (`America/New_York`). Answers in a zone with another UTC offset are dropped, unless that drops all.' },
      ],
      returns: ['status', 'query', 'city', 'regionName', 'country', 'lat', 'lon', 'isp', 'org', 'agreement', 'answered'],
    },
  ],
};
