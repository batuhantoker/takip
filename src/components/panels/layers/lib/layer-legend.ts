import { GDELT_FAMILY_COLOR } from '@/lib/alerts/gdelt-display';
import { MAP_INK } from '@/lib/map/tokens';
import { REFERENCE_DATASETS } from '@/lib/reference/catalog';
import { SHIP_CLASSES } from '@/lib/ships/filter';

/** How a layer looks on the map, small enough to sit beside its name. */
export type LegendShape = 'dot' | 'ring' | 'line' | 'area' | 'gradient' | 'plane' | 'cluster';

export interface LegendSpec {
  shape: LegendShape;
  /** One colour, or the stops of a gradient or the members of a cluster. */
  colors: string[];
}

const one = (shape: LegendShape, color: string): LegendSpec => ({ shape, colors: [color] });
const many = (shape: LegendShape, ...colors: string[]): LegendSpec => ({ shape, colors });

// Colours come from the same sources the map paints with, so the key cannot drift from the markers.
const LEGEND: Record<string, LegendSpec> = {
  flights: one('plane', 'var(--map-flight-civil)'),
  private: one('plane', 'var(--map-flight-private)'),
  jets: one('plane', 'var(--map-flight-gov)'),
  military: one('plane', 'var(--map-flight-military)'),
  airport_delays: many('cluster', MAP_INK.green, MAP_INK.amber, MAP_INK.red),

  maritime: many('cluster', SHIP_CLASSES[0].color, SHIP_CLASSES[1].color, SHIP_CLASSES[2].color),
  chokepoint_flow: one('ring', MAP_INK.ink2),
  sdk_sea: one('line', MAP_INK.slate),

  satellites: one('dot', 'var(--map-sat-other)'),
  sat_comms: one('dot', 'var(--map-sat-comms)'),
  sat_military: one('dot', 'var(--map-sat-military)'),
  sat_navigation: one('dot', 'var(--map-sat-navigation)'),
  sat_earth: one('dot', 'var(--map-sat-earth)'),
  sat_science: one('dot', 'var(--map-sat-science)'),
  launches: many('cluster', MAP_INK.green, MAP_INK.amber, MAP_INK.blue),
  sky_stars: one('dot', MAP_INK.ink1),
  aurora: many('gradient', MAP_INK.green, MAP_INK.violet, MAP_INK.rose),

  cctv: one('dot', 'var(--map-cctv)'),
  live_news: one('dot', MAP_INK.rose),

  wx_temperature: many('gradient', MAP_INK.blue, MAP_INK.sand, MAP_INK.red),
  wx_wind: many('gradient', MAP_INK.teal, MAP_INK.sand, MAP_INK.red),
  wx_radar: many('gradient', MAP_INK.green, MAP_INK.sand, MAP_INK.red),
  live_clouds: one('area', MAP_INK.ink2),
  earthquakes: one('ring', MAP_INK.amber),
  fires: one('dot', MAP_INK.amber),
  weather: many('cluster', MAP_INK.violet, MAP_INK.amber, MAP_INK.red),
  radiation: many('cluster', MAP_INK.violet, MAP_INK.amber, MAP_INK.red),
  outbreaks: one('ring', MAP_INK.amber),

  infrastructure: many('cluster', MAP_INK.teal, MAP_INK.amber, MAP_INK.red),
  global_incidents: one('dot', MAP_INK.red),
  alert_pins: many('cluster', MAP_INK.red, MAP_INK.amber, MAP_INK.blue),
  gdelt_events: many('cluster', GDELT_FAMILY_COLOR.violence, GDELT_FAMILY_COLOR.tension, GDELT_FAMILY_COLOR.protest),
  war_alerts: one('dot', MAP_INK.red),
  gps_jamming: many('gradient', MAP_INK.sand, MAP_INK.amber, MAP_INK.red),
  malware: one('dot', MAP_INK.red),
  cyber_attacks: one('dot', MAP_INK.amber),
  cf_outages: one('dot', MAP_INK.amber),
  cf_attacks: one('ring', MAP_INK.red),
  service_status: many('cluster', MAP_INK.red, MAP_INK.amber, MAP_INK.blue),

  // Waymarked Trails paints international routes red; the rest follow in other colours.
  hiking_routes: one('line', MAP_INK.red),

  ...Object.fromEntries(SHIP_CLASSES.map(c => [c.key, one('dot', c.color)])),
  ...Object.fromEntries(REFERENCE_DATASETS.map(d => [
    d.key,
    one(d.geometry === 'line' ? 'line' : d.geometry === 'polygon' ? 'area' : 'dot', d.color),
  ])),
};

/** The swatch for a layer, or null where the map's look is not a single mark (base settings, filters). */
export const legendFor = (key: string): LegendSpec | null => LEGEND[key] ?? null;
