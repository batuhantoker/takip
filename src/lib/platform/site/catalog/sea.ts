import type { LayerPage } from './types';

export const SEA: LayerPage[] = [
  {
    slug: 'ship-tracker',
    section: 'sea',
    layers: ['maritime'],
    requiresEnv: 'AIS_API_KEY',
    title: 'Live ship tracker: vessels on a map right now',
    description: 'Ships at sea right now on a free live map, from AIS: cargo ships, tankers, ferries, fishing boats and warships, with speed, heading and destination.',
    heading: 'Live ship tracker',
    lede: 'Ships broadcast their position, speed and destination over AIS. TAKIP draws the ones it hears, up to 20,000 at a time, and keeps them moving.',
    shows: [
      'Cargo ships, tankers, passenger ships, fishing boats, and military, service and leisure vessels, each a filter you can switch off.',
      '“Underway only” hides ships at anchor or moored, to show what is actually moving.',
      'Click a ship for its name, type, speed, heading, destination and MMSI, with links to MarineTraffic and VesselFinder.',
      'Major ports and ten key chokepoints are marked, with a live count of the ships near each port.',
    ],
    sources: [{ name: 'aisstream.io', detail: 'A live stream of AIS messages relayed from receivers around the world.' }],
    freshness: 'The map asks for new positions every 10 seconds. A ship not heard from for 10 minutes is dropped.',
    limits: [
      'AIS is mostly heard from the shore, so ships far out at sea often drop out. Coverage is best near busy coasts and ports.',
      'Warships and some others switch AIS off. A ship’s type and destination are typed in by its crew and are not always right.',
      'Port volumes and rankings are reference figures, not live; the counts of ships near each port are live.',
    ],
    view: { lat: 35, lon: 20, zoom: 3.5 },
    spots: [
      { label: 'Singapore Strait', view: { lat: 1.25, lon: 103.9, zoom: 9 }, note: 'One of the busiest stretches of water in the world.' },
      { label: 'The Bosphorus', view: { lat: 41.1, lon: 29.05, zoom: 11 }, note: 'Ships threading through the middle of Istanbul.' },
      { label: 'Rotterdam', view: { lat: 51.95, lon: 4.05, zoom: 10 }, note: 'Europe’s largest port.' },
      { label: 'English Channel', view: { lat: 50.5, lon: 0, zoom: 7.5 }, note: 'Traffic lanes between the North Sea and the Atlantic.' },
    ],
    related: ['chokepoints', 'undersea-cables', 'world-news-map'],
  },
  {
    slug: 'chokepoints',
    section: 'sea',
    layers: ['chokepoint_flow'],
    title: 'Strait of Hormuz, Suez and Malacca traffic tracker',
    description: 'Traffic through the world’s shipping chokepoints from IMF PortWatch: daily transits through Hormuz, Suez, Bab el-Mandeb, Malacca and more, against normal.',
    heading: 'Shipping chokepoints',
    lede: 'A handful of narrow passages carry much of the world’s trade. This layer shows how many ships have been passing through each, compared with that strait’s own recent normal.',
    shows: [
      'Each chokepoint IMF PortWatch tracks, marked by how its last week compares with the three months or so before it.',
      'Click one for the last 7 days as a share of normal (by tanker tonnage or ship count), a 30-day chart, and any disruption PortWatch has recorded.',
      'Switch on ships alongside to watch the traffic itself.',
    ],
    sources: [{ name: 'IMF PortWatch', detail: 'Daily transit estimates built from AIS by the IMF and the University of Oxford.' }],
    freshness: 'PortWatch publishes weekly, so the latest day shown is often a week or more old. TAKIP reads it every 6 hours.',
    limits: [
      'Transits are estimated from AIS by PortWatch, not counted at the strait.',
      'Normal is the strait’s own recent past, so after a long disruption the lower level becomes the new normal.',
    ],
    view: { lat: 20, lon: 45, zoom: 2.8 },
    spots: [
      { label: 'Strait of Hormuz', view: { lat: 26.5, lon: 56.3, zoom: 7 }, note: 'The way out of the Gulf for its oil and gas.' },
      { label: 'Bab el-Mandeb', view: { lat: 12.6, lon: 43.3, zoom: 7 }, note: 'The southern gate of the Red Sea.' },
      { label: 'Suez Canal', view: { lat: 30.5, lon: 32.35, zoom: 7.5 }, note: 'The shortcut between Europe and Asia.' },
      { label: 'Strait of Malacca', view: { lat: 2.5, lon: 101.3, zoom: 6.5 }, note: 'Between the Indian Ocean and the South China Sea.' },
    ],
    related: ['ship-tracker', 'world-news-map', 'undersea-cables'],
  },
];
