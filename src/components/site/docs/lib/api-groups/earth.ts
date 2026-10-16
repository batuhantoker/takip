import type { ApiGroup } from '../../api-catalog';

export const EARTH: ApiGroup = {
  id: 'earth',
  title: 'Earth and environment',
  blurb: 'Seismic, fire, weather, disaster, radiation, health, and orbital-imagery feeds.',
  endpoints: [
    {
      path: '/api/earthquakes',
      method: 'GET',
      summary: 'Recent earthquakes from USGS and EMSC, merged.',
      returns: ['earthquakes', 'twins', 'sources', 'total', 'timestamp'],
      notes:
        'M2.5+ over the trailing day. An event both catalogues report is kept once, with the other solution in `twin`; `twins` counts them. Each event carries `magnitude`, `place`, `depth`, `time`, `source`, `tsunami`, `alert`. `sources` says whether each catalogue answered.',
    },
    {
      path: '/api/fires',
      method: 'GET',
      summary: 'Active fire hotspots from NASA FIRMS, with EONET volcanoes and agency-reported Canadian wildfires.',
      returns: ['fires', 'fire_incidents', 'total', 'source', 'timestamp'],
      notes: 'Keyless: the FIRMS global 24-hour CSVs from the three VIIRS satellites (S-NPP, NOAA-20, NOAA-21), merged to one hotspot per ~1 km cell with `satellites` counting those that saw it; MODIS only when none answers. Up to 5,000 hotspots: the strongest half by fire power, and an even sample of the rest. `fire_incidents` are agency-reported Canadian incidents from CWFIS, with BC Wildfire names.',
    },
    {
      path: '/api/fires/perimeters',
      method: 'GET',
      summary: 'Current US wildfire perimeters from NIFC WFIGS, as GeoJSON.',
      returns: ['type', 'features', 'timestamp'],
      notes: 'Properties of each feature: `id`, `name`, `acres`, `contained` (percent), `discovered` and `mapped` (epoch ms), `state`, `county`, `kind` (`wildfire` or `prescribed`) and `cause`. Simplified to about 100 m; read every 10 minutes.',
    },
    {
      path: '/api/weather',
      method: 'GET',
      summary:
        'Severe weather and natural events: NASA EONET, NWS alerts, NHC cyclones, Environment Canada and provincial alerts, WMO SWIC warnings, the Hong Kong Observatory and GDACS.',
      returns: ['events', 'total', 'timestamp'],
    },
    {
      path: '/api/weather/nhc-forecast',
      method: 'GET',
      summary: 'The NHC forecast for each active Atlantic and East/Central Pacific storm: cone, track and forecast points, as GeoJSON.',
      returns: ['type', 'features', 'timestamp'],
      notes: 'Each feature has `kind` (`cone`, `track` or `point`), `storm`, `bin` and `advisory`; points add `hours` ahead, `when`, `stage`, `wind` and `gust` in knots and `pressure` in mb. Only geometry from the current advisory of each storm is kept. Read every 5 minutes.',
    },
    {
      path: '/api/weather-field/wind',
      method: 'GET',
      summary: 'NOAA GFS 10 m wind at 0.5°, the forecast step nearest now, as a compact binary field.',
      returns: ['(binary)'],
      notes: 'A JSON header line (`time`, `lat0`, `dLat`, `lng0`, `dLng`, `rows`, `cols`), then u and v as int16 little-endian tenths of m/s, each delta-coded row by row; `decodeWind` in `src/lib/feeds/weather/wind-field.ts` reads it. 503 when no field under six hours old is held.',
    },
    {
      path: '/api/weather-grid',
      method: 'GET',
      summary: 'Current conditions on a 510-point world grid from Open-Meteo: temperature, wind, gusts, precipitation, cloud and weather code.',
      returns: ['time', 'fetchedAt', 'attribution', 'lats', 'lngs', 'points'],
      notes: 'One 24-hour forecast is read every three hours and each request gets the hour nearest now. CC BY 4.0, credited in `attribution`.',
    },
    {
      path: '/api/air-quality',
      method: 'GET',
      summary: 'Modelled current air quality (CAMS via Open-Meteo) for ~50 major cities.',
      returns: ['stations', 'total', 'kind', 'source', 'timestamp'],
    },
    {
      path: '/api/gdelt',
      method: 'GET',
      summary: 'Current disaster alerts from GDACS: earthquakes, cyclones, floods, volcanoes and droughts.',
      returns: ['events', 'total', 'source', 'timestamp'],
      notes: 'Despite the path this is GDACS, not GDELT. GDELT events are /api/gdelt-events.',
    },
    {
      path: '/api/radiation',
      method: 'GET',
      summary: "Radiation monitors: EPA RadNet fixed stations, each rated against its own previous week, and Safecast's real-time sensors (unrated).",
      returns: ['stations', 'total', 'networks', 'timestamp'],
      notes: '`networks` counts stations per network.',
    },
    {
      path: '/api/outbreaks',
      method: 'GET',
      summary: 'Disease outbreaks as country-level points from WHO Disease Outbreak News, CDC travel notices and ECDC.',
      returns: ['outbreaks', 'worldwide', 'unmatched', 'sources', 'timestamp'],
      notes: 'A source that fails is listed in `sources`, never folded into an empty map. WHO content is CC BY-NC-SA 3.0 IGO; ECDC asks for attribution.',
    },
    {
      path: '/api/sentinel',
      method: 'GET',
      summary: 'Sentinel-1 radar (SAR) scenes covering a point, from Element 84 Earth Search with Copernicus as the fallback.',
      params: [
        { name: 'lat', required: true, desc: 'Latitude of the point of interest.', example: '51.5072' },
        { name: 'lng', required: true, desc: 'Longitude of the point of interest.', example: '-0.1276' },
        { name: 'radius', desc: 'Half-width of the search box, in degrees. Defaults to 2.', example: '2' },
        { name: 'days', desc: 'How far back to search, in days. Defaults to 30.', example: '30' },
      ],
      returns: ['source', 'scenes', 'total', 'bbox', 'datetime', 'timestamp'],
    },
  ],
};
