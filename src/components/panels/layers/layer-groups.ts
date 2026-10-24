import {
  Plane, Satellite, Sun, AlertTriangle, Camera,
  CloudLightning, Ship, Network, Megaphone, CloudSun, Mountain, Bus
} from 'lucide-react';
import { Car } from 'lucide-react';
import { msg } from '@/lib/core/i18n/translator';
import { SHIP_CLASSES, SHIPS_UNDERWAY } from '@/lib/feeds/maritime/ship-filter';
import { REFERENCE_LAYER_GROUPS } from '@/components/panels/layers/lib/reference-groups';

export interface LayerDef {
  key: string;
  label: string;
  dataKey: string;
  description?: string;
  /** Reads a bucket out of data.category_counts instead of a top-level array. */
  catKey?: string;
  /** Capability that must be configured server-side for this layer to appear. */
  requires?: string;
  /** Key of the layer this one sits under: a filter on it, or a layer drawn only
   *  beside it. Renders indented beneath it, and reads as inert while that parent is off. */
  parent?: string;
}

export interface LayerGroupDef {
  label: string;
  fullLabel: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  layers: LayerDef[];
}

export const LAYER_GROUPS: LayerGroupDef[] = [
  {
    label: 'SDK',
    fullLabel: 'TAKIP SDK',
    icon: Network,
    layers: [
      { key: 'sdk_sea', label: msg('Maritime Lines'), dataKey: 'sdk_entities' },
    ],
  },
  {
    label: 'WEATHER',
    fullLabel: msg('GLOBAL WEATHER'),
    icon: CloudSun,
    layers: [
      { key: 'wx_temperature', label: msg('Temperature'), description: msg('NOAA GFS · 0.25° · Open-Meteo until it loads'), dataKey: '' },
      { key: 'wx_wind', label: msg('Wind'), description: msg('NOAA GFS forecast · 10 m · streaks move with the wind · Open-Meteo arrows until it loads'), dataKey: '' },
      { key: 'wx_radar', label: msg('Rain Radar'), description: msg('RainViewer · where ground radar exists · last 2 hours, loops and follows Replay'), dataKey: '' },
      { key: 'wx_lightning', label: msg('Lightning'), description: msg('NOAA nowCOAST · strikes per 15 min · the Americas and the Pacific · follows Replay'), dataKey: '' },
      { key: 'live_clouds', label: msg('Live Clouds'), description: msg('NOAA satellites · lit in 3D · hourly'), dataKey: '' },
      { key: 'sat_live', label: msg('Satellite Live'), description: msg('GOES, Meteosat, Himawari · the whole Earth every 10 min, about 40 min behind'), dataKey: '' },
      { key: 'sat_daily', label: msg('Satellite Daily'), description: msg('NASA VIIRS and MODIS · the whole Earth once a day · follows History and Replay back to 2000'), dataKey: '' },
    ],
  },
  {
    label: 'AVIATION',
    fullLabel: msg('AVIATION'),
    icon: Plane,
    layers: [
      { key: 'flights', label: msg('Commercial'), dataKey: 'commercial_flights' },
      { key: 'private', label: msg('Private'), dataKey: 'private_flights' },
      { key: 'jets', label: msg('Private Jets'), dataKey: 'private_jets' },
      { key: 'military', label: msg('Military'), dataKey: 'military_flights' },
      { key: 'airport_delays', label: msg('Airport Delays'), description: msg('FAA ground stops and delays · US'), dataKey: 'airport_delays' },
      { key: 'airport_weather', label: msg('Airport Weather'), description: msg('METARs worldwide · VFR, MVFR, IFR, LIFR'), dataKey: '' },
      { key: 'sigmets', label: msg('Hazard Airspace'), description: msg('SIGMETs · storms, turbulence, icing, volcanic ash'), dataKey: '' },
    ],
  },
  {
    label: 'MARITIME',
    fullLabel: msg('MARITIME'),
    icon: Ship,
    layers: [
      { key: 'maritime', label: msg('Maritime / Naval'), dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
      { key: SHIPS_UNDERWAY, label: msg('Underway only'), description: msg('Hide anchored and moored'), dataKey: '', parent: 'maritime' },
      ...SHIP_CLASSES.map(c => ({ key: c.key, label: c.label, dataKey: '', parent: 'maritime' })),
      { key: 'chokepoint_flow', label: msg('Chokepoint Traffic'), description: msg('IMF PortWatch · daily transits vs. own baseline'), dataKey: 'chokepoint_flow' },
    ],
  },
  {
    label: 'TRANSIT',
    fullLabel: msg('PUBLIC TRANSIT'),
    icon: Bus,
    layers: [
      { key: 'transit', label: msg('Buses & Trains'), description: msg('Live buses, trams, trains and metros · vehicles from zoom 10'), dataKey: '' },
    ],
  },
  {
    label: 'SPACE',
    fullLabel: msg('SPACE TRACKING'),
    icon: Satellite,
    layers: [
      { key: 'satellites', label: msg('All Satellites'), dataKey: 'satellites' },
      { key: 'sat_comms', label: msg('Starlink / Comms'), dataKey: 'satellites', catKey: 'comms' },
      { key: 'sat_military', label: msg('Military / Intel'), dataKey: 'satellites', catKey: 'military' },
      { key: 'sat_navigation', label: msg('GPS / Navigation'), dataKey: 'satellites', catKey: 'navigation' },
      { key: 'sat_earth', label: msg('Earth Observation'), dataKey: 'satellites', catKey: 'earth_obs' },
      { key: 'sat_science', label: msg('Stations / Telescopes'), dataKey: 'satellites', catKey: 'science' },
      { key: 'launches', label: msg('Upcoming Launches'), description: msg('Launch Library 2 · next launch per pad'), dataKey: 'launches' },
      { key: 'sky_stars', label: msg('Stars & Planets'), description: msg('Real sky behind the globe · JPL Horizons · Yale BSC'), dataKey: '' },
      { key: 'aurora', label: msg('Aurora Forecast'), description: msg('NOAA OVATION · 30-min nowcast · ignores cloud'), dataKey: '' },
    ],
  },
  {
    label: 'SURVEIL',
    fullLabel: msg('SURVEILLANCE'),
    icon: Camera,
    layers: [
      { key: 'cctv', label: msg('CCTV Cameras'), dataKey: 'cameras' },
      { key: 'cctv_previews', label: msg('Live Previews'), dataKey: '', parent: 'cctv' },
      { key: 'alpr', label: msg('Plate Readers (ALPR)'), description: msg('DeFlock · OpenStreetMap · US and Canada · view cones from zoom 13'), dataKey: '' },
      { key: 'live_news', label: msg('Live News Feeds'), dataKey: 'live_feeds' },
      { key: 'gdelt_events', label: msg('GDELT Events'), description: msg('GDELT 2.0 · violence, protest and tension in world news · last 2 hours'), dataKey: 'gdelt_events', parent: 'live_news' },
    ],
  },
  {
    label: 'ROADS',
    fullLabel: msg('ROAD TRAFFIC'),
    icon: Car,
    layers: [
      { key: 'traffic', label: msg('Road Traffic'), description: msg('Measured speeds · worldwide with a TomTom key, else Netherlands, Rennes, Nantes · slow roads tinted from zoom 10'), dataKey: '' },
    ],
  },
  {
    label: 'HAZARD',
    fullLabel: msg('NATURAL HAZARDS'),
    icon: CloudLightning,
    layers: [
      { key: 'earthquakes', label: msg('Earthquakes'), dataKey: 'earthquakes' },
      { key: 'fires', label: msg('Active Fires'), description: msg('NASA FIRMS hotspots · NIFC perimeters (US) · CWFIS incidents (Canada)'), dataKey: 'fires' },
      { key: 'weather', label: msg('Severe Weather'), dataKey: 'weather_events' },
      { key: 'radiation', label: msg('Radiation'), description: msg('EPA RadNet · Safecast · hourly'), dataKey: 'radiation' },
      { key: 'outbreaks', label: msg('Disease Outbreaks'), description: msg('WHO · CDC · ECDC notices · by country'), dataKey: 'outbreaks' },
    ],
  },
  {
    label: 'THREAT',
    fullLabel: msg('THREATS & INTEL'),
    icon: AlertTriangle,
    layers: [
      { key: 'infrastructure', label: msg('Nuclear Facilities'), dataKey: 'infrastructure' },
      { key: 'global_incidents', label: msg('Global Incidents'), dataKey: 'gdelt' },
      { key: 'alert_pins', label: msg('Live Alert Pins'), dataKey: 'alert_pins' },
      { key: 'war_alerts', label: msg('Air-Raid Alerts'), description: msg('Israel sirens · Ukraine oblasts · live'), dataKey: 'war_alerts' },
      { key: 'gps_jamming', label: msg('GNSS Interference'), description: msg('Inferred from aircraft position accuracy · 2° cells'), dataKey: 'gps_jamming' },
    ],
  },
  {
    label: 'NETWORK',
    fullLabel: msg('NETWORK INTEL'),
    icon: Network,
    layers: [
      { key: 'malware', label: msg('Live Malware'), dataKey: 'malware_threats' },
      { key: 'cyber_attacks', label: msg('Botnet C2 Servers'), dataKey: 'cyber_attacks' },
    ],
  },
  {
    label: 'NETINTEL',
    fullLabel: msg('NET & EVENT INTEL'),
    icon: Megaphone,
    layers: [
      { key: 'cf_outages', label: msg('Internet Outages'), dataKey: 'cf_outages', requires: 'cloudflare' },
      { key: 'cf_attacks', label: msg('Attack Origins'), dataKey: 'cf_attack_origins', requires: 'cloudflare' },
      { key: 'service_status', label: msg('Service Incidents'), description: msg('Vendor status pages · pinned at HQ'), dataKey: 'service_status' },
    ],
  },
  ...REFERENCE_LAYER_GROUPS,
  {
    label: 'OUTDOOR',
    fullLabel: msg('OUTDOOR'),
    icon: Mountain,
    layers: [
      { key: 'hiking_routes', label: msg('Hiking Routes'), description: msg('Waymarked Trails · OpenStreetMap · worldwide'), dataKey: '' },
    ],
  },
  {
    label: 'DISPLAY',
    fullLabel: msg('DISPLAY'),
    icon: Sun,
    layers: [
      { key: 'day_night', label: msg('Day / Night Cycle'), dataKey: '' },
      { key: 'terrain_3d', label: msg('3D Buildings'), description: msg('City detail · zoom 14.5+'), dataKey: '' },
      { key: 'terrain_elevation', label: msg('3D Terrain'), description: msg('Mountains · zoom 10+'), dataKey: '' },
    ],
  },
];

/** Sub-layers only draw while their parent is on, so the parent alone counts as "on". */
export const primary = (layers: LayerDef[]) => layers.filter(l => !l.parent);
