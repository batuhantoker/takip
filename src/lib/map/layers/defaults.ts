import { REFERENCE_LAYER_DEFAULTS } from '@/lib/feeds/reference/catalog';

// ── DEFAULT: Most layers OFF — fast initial load ──
export const DEFAULT_LAYERS = {
  flights: false,
  private: false,
  jets: false,
  military: false,
  maritime: true,
  /* Vessel-class filters under Maritime — see lib/feeds/maritime/ship-filter. */
  ships_underway: false,
  ships_cargo: true,
  ships_tanker: true,
  ships_passenger: true,
  ships_fishing: true,
  ships_military: true,
  ships_service: true,
  ships_leisure: true,
  ships_other: true,
  // On from the start: the orbiting fleet around the globe is the first
  // thing the splash lifts onto.
  satellites: true,
  sat_comms: false,
  sat_military: false,
  sat_navigation: false,
  sat_earth: false,
  sat_science: false,
  balloons: false,
  launches: false,
  /* The bright stars, Sun, Moon and planets behind the globe — see lib/space/globe/sky-layer. */
  sky_stars: true,
  aurora: false,
  cctv: true,
  /* The live preview tiles over the camera dots — see CctvPreviews. */
  cctv_previews: true,
  /* Licence-plate readers mapped on OpenStreetMap — see lib/feeds/cameras. US and Canada. */
  alpr: false,
  /* Measured road speeds, slow roads tinted — see lib/feeds/traffic. */
  traffic: false,
  live_news: true,
  earthquakes: true,
  fires: false,
  weather: false,
  radiation: false,
  infrastructure: false,
  global_incidents: true,
  /* Live Alerts reports pinned to the place they name — see alert-places.
     Off until asked for, like the other threat layers: the map opens with
     what a reader has chosen to see, and the feed reads the same without it. */
  alert_pins: false,
  war_alerts: false,
  day_night: true,
  cables: true,
  sdk_sea: true,
  sdk_air: true,
  sdk_naval: true,
  /* NOAA's infrared cloud mosaic — see lib/feeds/weather/clouds. Off until asked for:
     it veils everything under it. */
  live_clouds: false,
  /* Global weather — GFS and Open-Meteo, RainViewer radar; see lib/feeds/weather. */
  wx_temperature: false,
  wx_wind: false,
  wx_radar: false,
  /* NOAA nowCOAST lightning density (lib/feeds/weather/lightning): the Americas and the Pacific only. */
  wx_lightning: false,
  /* NASA GIBS imagery — see lib/feeds/imagery/gibs. Off until asked for: both cover the base map. */
  sat_live: false,
  sat_daily: false,
  /* Waymarked Trails' OSM hiking routes — see lib/feeds/hiking. */
  hiking_routes: false,
  transit: false,
  terrain_3d: false,
  terrain_elevation: false,
  malware: false,
  cyber_attacks: false,
  gdelt_events: false,
  cf_outages: false,
  cf_attacks: false,
  service_status: false,
  gps_jamming: false,
  airport_delays: false,
  airport_weather: false,
  sigmets: false,
  chokepoint_flow: false,
  outbreaks: false,
  ...REFERENCE_LAYER_DEFAULTS,
};

export type ActiveLayers = typeof DEFAULT_LAYERS;
