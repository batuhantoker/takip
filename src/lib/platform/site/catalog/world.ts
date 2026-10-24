import type { LayerPage } from './types';

export const WORLD: LayerPage[] = [
  {
    slug: 'world-news-map',
    section: 'world',
    layers: ['alert_pins', 'live_news', 'gdelt_events'],
    title: 'World news map: breaking news and events by place',
    description: 'Breaking news placed on a live map: reports from news wires and public Telegram channels pinned to the places they name, beside GDELT’s coded events.',
    heading: 'World news on the map',
    lede: 'Reports from news wires and public channels, pinned to the town they name, beside GDELT’s machine-coded events: protests, violence and tension reported in the last two hours.',
    shows: [
      'Alert pins: reports from the last 72 hours, placed at the place they name. Click one for the report, its source and that source’s lean.',
      'GDELT events: violence, protest and tension reported by at least two outlets in the last two hours, sized by how many outlets report each.',
    ],
    sources: [
      { name: 'News wires', detail: 'Eleven public RSS feeds, among them the BBC, the Guardian, Al Jazeera, TASS and Anadolu.' },
      { name: 'Telegram', detail: 'Nine public channels.' },
      { name: 'GDELT 2.0', detail: 'Events coded every 15 minutes from news worldwide.' },
    ],
    freshness: 'Wires are read every 5 minutes and channels every 3. GDELT loads when you open the map.',
    limits: [
      'Places are found from the text of a report, so a pin is at best at town level, and sometimes wrong.',
      'Sources take sides. Each is labelled with its lean, and partisan ones are included on purpose.',
      'GDELT is coded by machine and sometimes places an event at the centre of a region.',
    ],
    view: { lat: 33, lon: 35, zoom: 3 },
    near: 3,
    related: ['air-raid-alerts', 'disaster-alerts', 'live-news'],
  },
  {
    slug: 'air-raid-alerts',
    section: 'world',
    layers: ['war_alerts'],
    title: 'Air-raid alerts map: Ukraine and Israel sirens, live',
    description: 'Air-raid alerts as they sound, on a live map: Ukraine’s regional alerts and Israel’s rocket sirens, with when each began and how many in the last day.',
    heading: 'Air-raid alerts',
    lede: 'Where air-raid sirens are sounding now, in Ukraine by region and in Israel by town, with how long each alert has run and how many there have been in the last day.',
    shows: [
      'Active alerts, and ones that have just ended.',
      'Click one for the place, when it started, the sirens there in the last 24 hours, and the source.',
    ],
    sources: [
      { name: 'Ukraine', detail: 'The official air-raid alert system, through a public mirror.' },
      { name: 'Israel', detail: 'Tzeva Adom, a community service that relays Home Front Command alerts.' },
    ],
    freshness: 'The map checks every minute. Ukraine’s data is treated as unavailable if it hasn’t refreshed in 10 minutes.',
    limits: [
      'Never rely on this for your safety. Use your official alert app.',
      'Both feeds are unofficial relays and can lag or drop out.',
    ],
    view: { lat: 48.8, lon: 31.5, zoom: 5.2 },
    spots: [
      { label: 'Ukraine', view: { lat: 48.8, lon: 31.5, zoom: 5.2 } },
      { label: 'Israel', view: { lat: 31.5, lon: 34.9, zoom: 7.5 } },
    ],
    related: ['world-news-map', 'military-aircraft', 'gps-jamming'],
  },
  {
    slug: 'disaster-alerts',
    section: 'world',
    layers: ['global_incidents'],
    title: 'Global disaster alerts map: GDACS, live',
    description: 'Earthquakes, tropical cyclones, floods, volcanoes and droughts flagged by GDACS, the UN and EU global disaster alert system, on a live map.',
    heading: 'Disaster alerts',
    lede: 'Alerts from GDACS, the disaster alert system run by the United Nations and the European Commission, which flags sudden disasters that may need an international response.',
    shows: [
      'A pin per current GDACS alert: earthquakes, tropical cyclones, floods, volcanoes, droughts and wildfires.',
      'Click one for its kind, its name and the GDACS report.',
    ],
    sources: [{ name: 'GDACS', detail: 'The Global Disaster Alert and Coordination System’s alert feed.' }],
    freshness: 'Read when you open the map, at most 5 minutes old; reload for the latest.',
    limits: ['GDACS alerts are automatic first estimates of impact, refined as reports come in.'],
    view: { lat: 10, lon: 20, zoom: 1.8 },
    near: 1.8,
    related: ['earthquakes', 'hurricanes', 'severe-weather', 'world-news-map'],
  },
];
