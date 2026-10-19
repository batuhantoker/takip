import type { LayerPage } from './types';

export const GROUND: LayerPage[] = [
  {
    slug: 'traffic',
    section: 'ground',
    layers: ['traffic'],
    // Without TomTom the layer covers only the Netherlands, Rennes and Nantes, which this page doesn't promise.
    requiresEnv: 'TOMTOM_API_KEY',
    title: 'Live traffic map: road speeds and congestion',
    description: 'Measured road speeds on a live map, worldwide from TomTom and in more detail from open data in the Netherlands and France, with slow roads tinted.',
    heading: 'Road traffic',
    lede: 'How fast traffic is moving, measured, with the slow and jammed roads tinted, so congestion stands out without covering the map.',
    shows: [
      'Slow and congested roads tinted, from zoom 10.',
      'Click a road for its speed, the share of its usual speed, and when it was measured.',
    ],
    sources: [
      { name: 'TomTom', detail: 'Traffic flow worldwide.' },
      { name: 'NDW', detail: 'The Dutch national road data warehouse.' },
      { name: 'Rennes and Nantes Métropole', detail: 'Open traffic data from the two French cities.' },
    ],
    freshness: 'The map refreshes every 2 minutes.',
    limits: [
      'Only slow and congested roads are tinted; free-flowing roads stay clear.',
      'Shown from zoom 10, about a city at a time.',
    ],
    view: { lat: 52.37, lon: 4.9, zoom: 11 },
    related: ['live-transit', 'live-cameras', 'plate-readers'],
  },
  {
    slug: 'live-transit',
    section: 'ground',
    layers: ['transit'],
    title: 'Live bus and train map: transit vehicles in real time',
    description: 'Buses, trams, trains and metros moving in real time in hundreds of cities, from about 750 open transit feeds, with the route and status of each vehicle.',
    heading: 'Buses and trains, live',
    lede: 'Hundreds of transit agencies publish where their vehicles are. TAKIP draws them moving, so you can watch a city’s buses, trams and trains as they run.',
    shows: [
      'Vehicles from zoom 10. Zoomed out, the cities with data are listed on the map.',
      'Click a vehicle for its route, label, status, speed and operator.',
      'Each vehicle says whether it is live, estimated or running from the timetable, so you know which you are looking at.',
    ],
    sources: [
      { name: 'Mobility Database and Transitland', detail: 'About 750 GTFS Realtime feeds in about 40 countries.' },
      { name: 'Agency APIs', detail: 'Istanbul’s İETT buses, LA Metro Rail, Chicago’s ‘L’, the London Underground, Barcelona’s FGC, Tokyo’s Toei and others.' },
    ],
    freshness: 'Vehicles refresh every 20 seconds while you are zoomed in.',
    limits: [
      'Some systems publish only arrival predictions. Their trains are placed between stops from those, and marked estimated.',
      'Where nothing live exists, as on the Istanbul and İzmir metros, trains run from the timetable and are marked as such.',
      'Most feeds are in the US, Canada and France.',
    ],
    view: { lat: 40.75, lon: -73.98, zoom: 11.5 },
    spots: [
      { label: 'New York', view: { lat: 40.75, lon: -73.98, zoom: 11.5 }, note: 'Buses live; the subway placed from its arrival times.' },
      { label: 'London', view: { lat: 51.51, lon: -0.12, zoom: 11.5 } },
      { label: 'Istanbul', view: { lat: 41.01, lon: 28.97, zoom: 11 }, note: 'İETT buses live; the metro from its timetable.' },
      { label: 'San Francisco', view: { lat: 37.77, lon: -122.42, zoom: 11.5 } },
    ],
    related: ['traffic', 'live-cameras', 'flight-tracker'],
  },
  {
    slug: 'hiking-trails',
    section: 'ground',
    layers: ['hiking_routes'],
    title: 'Hiking trails map: long-distance and local routes',
    description: 'Waymarked hiking routes worldwide from OpenStreetMap: international and national trails at every zoom, and regional and local paths as you zoom in.',
    heading: 'Hiking routes',
    lede: 'Waymarked hiking routes from OpenStreetMap, through Waymarked Trails: from the long-distance trails that cross continents down to local loops.',
    shows: [
      'International and national routes at every zoom, regional ones from zoom 7 and local ones from zoom 10.',
      'Click a route for its network, itinerary, mapped and official length, operator, and links.',
    ],
    sources: [{ name: 'Waymarked Trails', detail: 'Hiking routes mapped on OpenStreetMap.' }],
    freshness: 'Kept up to date with OpenStreetMap by Waymarked Trails.',
    limits: ['Only routes someone has mapped as a route on OpenStreetMap; coverage is richest in Europe.'],
    view: { lat: 46.5, lon: 9, zoom: 6 },
    related: ['live-cameras', 'temperature-map'],
  },
];
