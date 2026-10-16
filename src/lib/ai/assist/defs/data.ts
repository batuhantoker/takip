/** The tools that read live data: searching it, and looking up an aircraft, the weather, the sky, a place or a route. */
import { FIND_LAYERS, SOURCES } from '../catalog';
import { KINDS } from '../actions/nearby';
import { place, type ToolDef } from './define';

const finds = () => FIND_LAYERS.map(l => `    ${l}: ${SOURCES[l].about}`).join('\n');

export const DATA_DEFS = {
  find: {
    name: 'find', title: 'Search live data', surfaces: ['ti', 'mcp'],
    about: 'Search the live data: one layer, or several (layers). Scope it with near (a place or coordinates, radius_km default 500), region (a country or state name: "Texas", "Ukraine"), or in_view (the map on screen). where filters on fields: [{field, op, value}] with op gt, gte, lt, lte, eq, neq or contains; a number may carry a unit ("10000 ft", "FL350", "300 kn"). Common fields: id, name, lat, lng, time, km (from the centre), age_h. Per layer: flights and military_flights altitude (m), speed (kn), heading, callsign, icao24, registration, model, category, airline, squawk, emergency, grounded, helicopter; ships speed (kn), heading, mmsi, type, destination; earthquakes magnitude, depth (km), tsunami, alert; fires power (MW), confidence; fire_incidents area (ha), stage; radiation dose (nSv/h), status; satellites altitude (km), norad, category, mission; launches provider, rocket, orbit, status; news risk, source; infrastructure type, status, capacity (MW); cables length (km). min is a shortcut for the layer\'s main value. sort: nearest, newest, oldest, largest, smallest or any field, with order asc or desc. follow_up: true searches only the matches of your previous find ("which of those is fastest?"). The result says complete: false when the feed cannot see everything, so its count is a floor: say "at least N". A bad field, operator or unit is refused with the fields allowed: fix the call and try again.',
    ti: `Switches the layers on if they are off. show (default true) marks the results on the map and frames them. Every row has an id to pass to track, aircraft or pass. Layers:\n${finds()}`,
    mcp: `Layers: ${FIND_LAYERS.join(', ')}.`,
    params: {
      layer: { type: 'string', enum: FIND_LAYERS, about: 'The layer to search.' },
      layers: { type: 'array', items: { type: 'string', enum: FIND_LAYERS, about: 'A layer.' }, about: 'Several layers at once.' },
      text: { type: 'string', about: 'Words that must appear in the name, details or id.' },
      near: place('Around a place or point.'),
      radius_km: { type: 'number', about: 'Radius round near, default 500.' },
      region: { type: 'string', about: 'Inside a country or state.' },
      in_view: { type: 'boolean', about: 'Only what is in the map view (TI only).' },
      where: { type: 'array', about: 'Field filters, all must hold.', items: { type: 'object', about: 'A filter.', props: { field: { type: 'string', about: 'Field name, optionally with a unit: "altitude(ft)".', required: true }, op: { type: 'string', enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'contains'], about: 'Comparison.', required: true }, value: { type: 'string', about: 'A number (with an optional unit), text, true/false or an ISO time.', required: true } } } },
      min: { type: 'number', about: 'At least this main value (magnitude, altitude, fire power).' },
      within_hours: { type: 'number', about: 'Only things dated within this many hours.' },
      sort: { type: 'string', about: 'nearest, newest, oldest, largest, smallest, or a field.' },
      order: { type: 'string', enum: ['asc', 'desc'], about: 'Sort direction.' },
      limit: { type: 'integer', min: 1, max: 25, about: 'Rows to return, default 10.' },
      follow_up: { type: 'boolean', about: 'Search only the previous find\'s matches.' },
      show: { type: 'boolean', about: 'Mark the results on the map (TI only, default true).' },
    },
  },
  scan: {
    name: 'scan', title: 'What is here', surfaces: ['ti', 'mcp'],
    about: 'Count and summarise everything live in an area, layer by layer, with the biggest few of each, and say how fresh each feed is.',
    ti: 'With no near it reads the part of the map in view now. Use it for "what am I looking at", "what is happening here". Results come back to you.',
    mcp: 'Give near (a place or point) and radius_km.',
    params: { layers: { type: 'array', items: { type: 'string', enum: FIND_LAYERS, about: 'A layer.' }, about: 'Only these layers.' }, near: place('Centre of the area.'), radius_km: { type: 'number', about: 'Radius, default 250.' } },
  },
  aircraft: {
    name: 'aircraft', title: 'One aircraft', surfaces: ['ti', 'mcp'],
    about: 'Everything known about one aircraft in the air now: type, operator and registration, where it is, how high and fast, the airport it left and where it is going, and its flown track. Give its icao24 hex (id from find) or a callsign or registration.',
    ti: 'show (default true) draws its track on the map and frames it.',
    params: { id: { type: 'string', about: 'icao24 hex.' }, callsign: { type: 'string', about: 'Callsign, e.g. BAW123.' }, registration: { type: 'string', about: 'Registration, e.g. G-XWBA.' }, show: { type: 'boolean', about: 'Draw the track (TI only, default true).' } },
  },
  weather: {
    name: 'weather', title: 'Weather at a place', surfaces: ['ti', 'mcp'],
    about: 'The weather at a place now: the nearest airport\'s latest observation (METAR: temperature, wind, visibility, cloud, flight category) with its distance, the model forecast for the next hours at the point itself, the ground\'s height there, and any official warnings within 150 km.',
    params: { place: place('The place.', true) },
  },
  pass: {
    name: 'pass', title: 'Satellite passes', surfaces: ['ti', 'mcp'],
    about: 'When a satellite next crosses the sky over a place: rise, highest point and set times in UTC, the highest elevation and compass directions, and whether it can be seen by eye (sunlit while the sky is dark). satellite: a name or NORAD id (default the ISS). With overhead: true, it lists the satellites above the place right now instead, highest first.',
    params: { near: place('The observer\'s place.', true), satellite: { type: 'string', about: 'Name or NORAD id; default ISS.' }, hours: { type: 'integer', min: 1, max: 72, about: 'How far ahead to look, default 24.' }, visible_only: { type: 'boolean', about: 'Only passes visible by eye.' }, overhead: { type: 'boolean', about: 'List what is overhead now.' }, min_elevation: { type: 'number', about: 'With overhead: degrees above the horizon, default 10.' } },
  },
  brief: {
    name: 'brief', title: 'Situation at a place', surfaces: ['ti', 'mcp'],
    about: 'A situation brief for a place: earthquakes, fires, weather warnings, disaster and air-raid alerts and radiation within radius_km (default 300), the traffic in the air and at sea, the latest headlines that name it, and the country\'s travel advice and background.',
    ti: 'It reads the layers the page has loaded; switch others on first if they matter.',
    params: { place: place('The place.', true), radius_km: { type: 'number', about: 'Radius, default 300.' } },
  },
  route: {
    name: 'route', title: 'Route between places', surfaces: ['ti', 'mcp'],
    about: 'A route by road, bike or on foot between two places, with its distance, travel time and the main turns.',
    ti: 'show (default true) draws it on the map.',
    params: { from: place('Start.', true), to: place('End.', true), mode: { type: 'string', enum: ['drive', 'bike', 'walk'], about: 'Default drive.' }, show: { type: 'boolean', about: 'Draw it (TI only, default true).' } },
  },
  nearby: {
    name: 'nearby', title: 'Mapped places near a point', surfaces: ['ti', 'mcp'],
    about: `What OpenStreetMap maps around a place, by kind, nearest first, within radius_km (default 15, at most 50): ${Object.entries(KINDS).map(([k, v]) => `${k} (${v.label})`).join(', ')}. OpenStreetMap is mapped by volunteers, so say that an empty answer is not proof of absence.`,
    ti: 'show (default true) marks them on the map.',
    params: { near: place('The place.', true), kind: { type: 'string', enum: Object.keys(KINDS), about: 'What to look for.', required: true }, radius_km: { type: 'number', about: 'Radius, default 15, at most 50.' }, limit: { type: 'integer', min: 1, max: 50, about: 'Rows, default 15.' }, show: { type: 'boolean', about: 'Mark them (TI only, default true).' } },
  },
  markets: {
    name: 'markets', title: 'Market quotes', surfaces: ['ti'],
    about: 'Latest quotes for indices, commodities, crypto and FX (names or tickers, e.g. "Brent", "Gold", "S&P 500", "BTC"). No symbols: the main board. Results come back to you.',
    params: { symbols: { type: 'array', items: { type: 'string', about: 'Name or ticker.' }, about: 'What to quote.' } },
  },
} satisfies Record<string, ToolDef>;
