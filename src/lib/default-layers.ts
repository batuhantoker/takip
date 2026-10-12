// ── DEFAULT: Most layers OFF — fast initial load ──
export const DEFAULT_LAYERS = {
  flights: false,
  private: false,
  jets: false,
  military: false,
  maritime: true,
  /* Vessel-class filters under Maritime — see lib/ship-filter. */
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
  cctv: true,
  /* The live preview tiles over the camera dots — see CctvPreviews. */
  cctv_previews: true,
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
  /* NOAA's infrared cloud mosaic — see lib/live-clouds. Off until asked for:
     it veils everything under it. */
  live_clouds: false,
  /* Global weather — Open-Meteo grid and RainViewer radar; see lib/weather-field. */
  wx_temperature: false,
  wx_wind: false,
  wx_radar: false,
  terrain_3d: false,
  terrain_elevation: false,
  malware: false,
  cyber_attacks: false,
  gdelt_events: false,
  cf_outages: false,
  cf_attacks: false,
};

export type ActiveLayers = typeof DEFAULT_LAYERS;
