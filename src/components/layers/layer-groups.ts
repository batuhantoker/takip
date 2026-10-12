import {
  Plane, Satellite, Sun, AlertTriangle, Camera,
  CloudLightning, Ship, Network, Megaphone, CloudSun
} from 'lucide-react';
import { SHIP_CLASSES, SHIPS_UNDERWAY } from '@/lib/ship-filter';
import { REFERENCE_LAYER_GROUPS } from './reference-groups';

export interface LayerDef {
  key: string;
  label: string;
  dataKey: string;
  description?: string;
  /** Reads a bucket out of data.category_counts instead of a top-level array. */
  catKey?: string;
  /** Capability that must be configured server-side for this layer to appear. */
  requires?: string;
  /** Key of the layer this one modifies. Renders indented beneath it, and reads
   *  as inert while that parent is off — it has nothing to act on. */
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
      { key: 'sdk_sea', label: 'Maritime Lines', dataKey: 'sdk_entities' },
    ],
  },
  {
    label: 'WEATHER',
    fullLabel: 'GLOBAL WEATHER',
    icon: CloudSun,
    layers: [
      { key: 'wx_temperature', label: 'Temperature', description: 'Open-Meteo · global · hourly', dataKey: '' },
      { key: 'wx_wind', label: 'Wind', description: 'Open-Meteo · 10 m · arrows show where it blows', dataKey: '' },
      { key: 'wx_radar', label: 'Rain Radar', description: 'RainViewer · where ground radar exists', dataKey: '' },
      { key: 'live_clouds', label: 'Live Clouds', description: 'NOAA satellites · lit in 3D · hourly', dataKey: '' },
    ],
  },
  {
    label: 'AVIATION',
    fullLabel: 'AVIATION',
    icon: Plane,
    layers: [
      { key: 'flights', label: 'Commercial', dataKey: 'commercial_flights' },
      { key: 'private', label: 'Private', dataKey: 'private_flights' },
      { key: 'jets', label: 'Private Jets', dataKey: 'private_jets' },
      { key: 'military', label: 'Military', dataKey: 'military_flights' },
      { key: 'airport_delays', label: 'Airport Delays', description: 'FAA ground stops and delays · US', dataKey: 'airport_delays' },
    ],
  },
  {
    label: 'MARITIME',
    fullLabel: 'MARITIME',
    icon: Ship,
    layers: [
      { key: 'maritime', label: 'Maritime / Naval', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
      { key: SHIPS_UNDERWAY, label: 'Underway only', description: 'Hide anchored and moored', dataKey: '', parent: 'maritime' },
      ...SHIP_CLASSES.map(c => ({ key: c.key, label: c.label, dataKey: '', parent: 'maritime' })),
      { key: 'chokepoint_flow', label: 'Chokepoint Traffic', description: 'IMF PortWatch · daily transits vs. own baseline', dataKey: 'chokepoint_flow' },
    ],
  },
  {
    label: 'SPACE',
    fullLabel: 'SPACE TRACKING',
    icon: Satellite,
    layers: [
      { key: 'satellites', label: 'All Satellites', dataKey: 'satellites' },
      { key: 'sat_comms', label: 'Starlink / Comms', dataKey: 'satellites', catKey: 'comms' },
      { key: 'sat_military', label: 'Military / Intel', dataKey: 'satellites', catKey: 'military' },
      { key: 'sat_navigation', label: 'GPS / Navigation', dataKey: 'satellites', catKey: 'navigation' },
      { key: 'sat_earth', label: 'Earth Observation', dataKey: 'satellites', catKey: 'earth_obs' },
      { key: 'sat_science', label: 'Stations / Telescopes', dataKey: 'satellites', catKey: 'science' },
    ],
  },
  {
    label: 'SURVEIL',
    fullLabel: 'SURVEILLANCE',
    icon: Camera,
    layers: [
      { key: 'cctv', label: 'CCTV Cameras', dataKey: 'cameras' },
      { key: 'cctv_previews', label: 'Live Previews', dataKey: '', parent: 'cctv' },
      { key: 'live_news', label: 'Live News Feeds', dataKey: 'live_feeds' },
    ],
  },
  {
    label: 'HAZARD',
    fullLabel: 'NATURAL HAZARDS',
    icon: CloudLightning,
    layers: [
      { key: 'earthquakes', label: 'Earthquakes', dataKey: 'earthquakes' },
      { key: 'fires', label: 'Active Fires', description: 'NASA FIRMS hotspots · CWFIS incidents (Canada)', dataKey: 'fires' },
      { key: 'weather', label: 'Severe Weather', dataKey: 'weather_events' },
      { key: 'radiation', label: 'Radiation', description: 'EPA RadNet · Safecast · hourly', dataKey: 'radiation' },
      { key: 'outbreaks', label: 'Disease Outbreaks', description: 'WHO · CDC · ECDC notices · by country', dataKey: 'outbreaks' },
    ],
  },
  {
    label: 'THREAT',
    fullLabel: 'THREATS & INTEL',
    icon: AlertTriangle,
    layers: [
      { key: 'infrastructure', label: 'Nuclear Facilities', dataKey: 'infrastructure' },
      { key: 'global_incidents', label: 'Global Incidents', dataKey: 'gdelt' },
      { key: 'alert_pins', label: 'Live Alert Pins', dataKey: 'alert_pins' },
      { key: 'gdelt_events', label: 'GDELT Events', dataKey: 'gdelt_events' },
      { key: 'war_alerts', label: 'Air-Raid Alerts', description: 'Israel sirens · Ukraine oblasts · live', dataKey: 'war_alerts' },
    ],
  },
  {
    label: 'NETWORK',
    fullLabel: 'NETWORK INTEL',
    icon: Network,
    layers: [
      { key: 'malware', label: 'Live Malware', dataKey: 'malware_threats' },
      { key: 'cyber_attacks', label: 'Botnet C2 Servers', dataKey: 'cyber_attacks' },
    ],
  },
  {
    label: 'NETINTEL',
    fullLabel: 'NET & EVENT INTEL',
    icon: Megaphone,
    layers: [
      { key: 'cf_outages', label: 'Internet Outages', dataKey: 'cf_outages', requires: 'cloudflare' },
      { key: 'cf_attacks', label: 'Attack Origins', dataKey: 'cf_attack_origins', requires: 'cloudflare' },
    ],
  },
  ...REFERENCE_LAYER_GROUPS,
  {
    label: 'DISPLAY',
    fullLabel: 'DISPLAY',
    icon: Sun,
    layers: [
      { key: 'day_night', label: 'Day / Night Cycle', dataKey: '' },
      { key: 'terrain_3d', label: '3D Buildings', description: 'City detail · zoom 14.5+', dataKey: '' },
      { key: 'terrain_elevation', label: '3D Terrain', description: 'Mountains · zoom 10+', dataKey: '' },
    ],
  },
];

/** Sub-layers modify a parent rather than draw anything, so they never count as "on". */
export const primary = (layers: LayerDef[]) => layers.filter(l => !l.parent);
