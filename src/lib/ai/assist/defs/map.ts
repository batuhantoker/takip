/** The tools that work the map: the camera, layers, marks, panels and following things. */
import { LAYERS, PANELS } from '../catalog';
import { place, type ToolDef } from './define';

const list = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k} (${v})`).join(', ');
const latlng = { lat: { type: 'number', about: 'Latitude.', required: true }, lng: { type: 'number', about: 'Longitude.', required: true } } as const;

export const MAP_DEFS = {
  go_to: {
    name: 'go_to', title: 'Fly the map', surfaces: ['ti'], readOnly: false,
    about: 'Fly the map. Give a place name (looked up for you) or coordinates. zoom: 2 world, 4 country, 6 region, 9 city, 12 district, 15 street.',
    params: { place: { type: 'string', about: 'A place name.' }, lat: { type: 'number', about: 'Latitude.' }, lng: { type: 'number', about: 'Longitude.' }, zoom: { type: 'number', about: 'Zoom level.' } },
  },
  move: {
    name: 'move', title: 'Move the camera', surfaces: ['ti'], readOnly: false,
    about: 'Move the camera from where it is: zoom_by levels in (+) or out (-); tilt to degrees from straight down (0 flat, 60 oblique, 85 horizon); rotate_by degrees clockwise; north_up; pan a direction by a screen; orbit slowly round the centre for orbit seconds (default 30); world for the whole Earth keeping the centre; stop ends an orbit. Any touch of the map by the reader stops it too.',
    params: {
      zoom_by: { type: 'number', about: 'Zoom levels in (+) or out (-), e.g. 1 or -2.' },
      tilt: { type: 'number', about: 'Pitch in degrees from straight down, 0-85.' },
      rotate_by: { type: 'number', about: 'Degrees to turn clockwise.' },
      north_up: { type: 'boolean', about: 'Turn the map so north is up.' },
      pan: { type: 'string', enum: ['north', 'south', 'east', 'west'], about: 'Slide the view a screen this way.' },
      orbit: { type: 'number', about: 'Orbit round the centre for this many seconds (5-120).' },
      world: { type: 'boolean', about: 'Zoom out to the whole Earth.' },
      stop: { type: 'boolean', about: 'Stop an orbit.' },
    },
  },
  layers: {
    name: 'layers', title: 'Switch layers', surfaces: ['ti'], readOnly: false,
    about: `Switch map layers by id: ${list(LAYERS)}.`,
    params: { on: { type: 'array', items: { type: 'string', about: 'Layer id.' }, about: 'Layers to switch on.' }, off: { type: 'array', items: { type: 'string', about: 'Layer id.' }, about: 'Layers to switch off.' } },
  },
  track: {
    name: 'track', title: 'Track an aircraft, ship or satellite', surfaces: ['ti'], readOnly: false,
    about: 'Open the card of one aircraft, ship or satellite and keep the camera on it as it moves. Give its id from RESULTS (icao24 for aircraft, MMSI for ships, NORAD id for satellites), or a callsign, registration or name as text, or nearest_to a place for the nearest airborne aircraft there. layer narrows the search: flights, military_flights, ships or satellites. The reader dragging the map stops following.',
    params: {
      id: { type: 'string', about: 'icao24, MMSI or NORAD id, from RESULTS.' },
      text: { type: 'string', about: 'A callsign, registration or name.' },
      layer: { type: 'string', enum: ['flights', 'military_flights', 'ships', 'satellites'], about: 'Where to look.' },
      nearest_to: place('A place: the nearest aircraft (or ship, with layer ships) there.'),
    },
  },
  untrack: {
    name: 'untrack', title: 'Stop tracking', surfaces: ['ti'], readOnly: false,
    about: 'Stop keeping the camera on what is being tracked.', params: {},
  },
  highlight: {
    name: 'highlight', title: 'Mark the map', surfaces: ['ti'], readOnly: false,
    about: 'Mark the map. points: labelled pins. area: a circle round a point. arrows: a great-circle line from one place to another, labelled with its distance (each end a place name or {lat, lng}). path: a line through points, e.g. a route you know. outline: country or state names to draw the borders of ("Texas", "Ukraine"). keep: true adds to the marks already there instead of replacing them. frame (default true) moves the camera to them.',
    params: {
      points: { type: 'array', about: 'Pins.', items: { type: 'object', about: 'A pin.', props: { ...latlng, label: { type: 'string', about: 'Its label.' } } } },
      area: { type: 'object', about: 'A circle.', props: { ...latlng, radius_km: { type: 'number', about: 'Radius in km.' }, label: { type: 'string', about: 'Its label.' } } },
      arrows: { type: 'array', about: 'Lines from one place to another, with the distance.', items: { type: 'object', about: 'An arrow.', props: { from: place('Start.', true), to: place('End.', true), label: { type: 'string', about: 'Optional label.' } } } },
      path: { type: 'array', about: 'A line through these points, in order.', items: { type: 'object', about: 'A point.', props: latlng } },
      outline: { type: 'array', about: 'Countries or states to outline.', items: { type: 'string', about: 'A country or state name.' } },
      keep: { type: 'boolean', about: 'Add to the marks already on the map.' },
      frame: { type: 'boolean', about: 'Move the camera to the marks (default true).' },
    },
  },
  show: {
    name: 'show', title: 'Show a card', surfaces: ['ti'], readOnly: false,
    about: 'Put a card in the conversation: a list the reader can click to fly to each item. Use it to put what they asked for on screen.',
    params: { title: { type: 'string', about: 'Card title.', required: true }, items: { type: 'array', about: 'Rows.', required: true, items: { type: 'object', about: 'A row.', props: { label: { type: 'string', about: 'Row text.', required: true }, detail: { type: 'string', about: 'Second line.' }, lat: { type: 'number', about: 'Latitude.' }, lng: { type: 'number', about: 'Longitude.' } } } } },
  },
  open: {
    name: 'open', title: 'Open or close a panel', surfaces: ['ti'], readOnly: false,
    about: `Open a panel, or close it with close: true: ${list(PANELS)}.`,
    params: { panel: { type: 'string', about: 'Panel id.', required: true }, close: { type: 'boolean', about: 'Close it instead.' } },
  },
  map_view: {
    name: 'map_view', title: 'Map projection and basemap', surfaces: ['ti'], readOnly: false,
    about: 'Switch between the 3D globe and the flat map, and the night or satellite basemap.',
    params: { projection: { type: 'string', enum: ['globe', 'flat'], about: 'Globe or flat map.' }, style: { type: 'string', enum: ['dark', 'satellite'], about: 'Basemap.' } },
  },
  camera: {
    name: 'camera', title: 'Look through a camera', surfaces: ['ti'], readOnly: false,
    about: 'Look through a live public camera with TAKIP\'s built-in image analysis. It opens the camera for the reader and counts what is in view (people, cars, trucks, buses, motorbikes, bicycles, boats, trains, aircraft) and how light it is; with watch_seconds it follows the feed that long and reports how the counts and the movement changed. Give a camera\'s id from find (layer cameras), or near: a place, for the nearest camera that can be analysed (radius default 30 km). Results come back to you; when your model can read images, the frame itself is attached too. Use it for "how busy is…", "is there traffic, a crowd, snow or flooding at…", "what does it look like at… right now". One camera per call; a watch of 20 to 30 seconds shows whether traffic is moving.',
    params: { id: { type: 'string', about: 'Camera id.' }, near: place('A place.'), radius_km: { type: 'number', about: 'Search radius.' }, watch_seconds: { type: 'integer', min: 0, max: 60, about: 'Seconds to watch.' } },
  },
  link: {
    name: 'link', mcpName: 'show_in_takip', title: 'Show it in TAKIP', surfaces: ['ti', 'mcp'],
    about: 'A link that opens TAKIP on a view: a place (or lat and lng) at a zoom, with layers on, optionally tracking one aircraft, ship or satellite (track: "aircraft:<icao24>", "ship:<mmsi>" or "satellite:<norad>").',
    ti: 'With no place it links the view on screen now. Give the reader the link in your words.',
    mcp: 'Hand the link to the person: it opens the live map in a browser.',
    params: {
      place: place('Where to centre.'),
      zoom: { type: 'number', about: 'Zoom level, 2 world to 15 street.' },
      layers: { type: 'array', items: { type: 'string', about: 'Layer id.' }, about: `Layers to switch on: ${Object.keys(LAYERS).join(', ')}.` },
      track: { type: 'string', about: 'What to follow: "aircraft:<icao24>", "ship:<mmsi>" or "satellite:<norad>".' },
    },
  },
  timeline: {
    name: 'timeline', title: 'Replay and History', surfaces: ['ti'], readOnly: false,
    about: 'Drive the map\'s clocks. mode "replay" shows the recorded last days of aircraft, ships and satellites (at: an ISO time or "2 hours ago"); "history" shows the past by year, with borders, wars and events (at: a year such as 1914 or "500 BC", or a date); "live" goes back to now. play starts or pauses the clock; speed is how many times real time it plays.',
    params: { mode: { type: 'string', enum: ['replay', 'history', 'live'], about: 'Which clock.', required: true }, at: { type: 'string', about: 'When to go to.' }, play: { type: 'boolean', about: 'Play or pause.' }, speed: { type: 'number', about: 'Times real time.' } },
  },
  clear: {
    name: 'clear', title: 'Clear the marks', surfaces: ['ti'], readOnly: false,
    about: 'Remove your highlights from the map.', params: {},
  },
} satisfies Record<string, ToolDef>;
