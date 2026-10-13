import type * as maplibregl from 'maplibre-gl';
import { ALERT_KINDS } from './alert-digest';
import { GDELT_FAMILY_COLOR } from './gdelt-display';
import { readMapPalette } from './map-palette';
import { createSatelliteLayer } from './satellite-layer';
import { SHIP_FALLBACK_COLOR, shipColorArms } from './ship-filter';

export const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

type CirclePaint = NonNullable<Extract<Parameters<maplibregl.Map['addLayer']>[0], { type: 'circle' }>['paint']>;

/** A colour, or an expression for one, as addLayer takes it. */
type LayerColor = NonNullable<Extract<Parameters<maplibregl.Map['addLayer']>[0], { type: 'circle' }>['paint']>['circle-color'];

// Create aircraft icon on canvas (for WebGL symbol layer)
const createIcon = (map: maplibregl.Map, id: string, color: string, size: number) => {
  if (map.hasImage(id)) return;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.4);
  ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
  ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
  ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
  ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
  ctx.lineTo(cx, cy + size * 0.35);
  ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
  ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
  ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
  ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
  ctx.closePath();
  ctx.fill();
  map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
};

const createDot = (map: maplibregl.Map, id: string, color: string, size: number) => {
  if (map.hasImage(id)) return;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
  ctx.fill();
  map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
};

export function addBaseLayers(map: maplibregl.Map, theme: 'core' | 'ghost', satLayerRef: { current: ReturnType<typeof createSatelliteLayer> | null }) {
  // Theme colors
  const isGhost = theme === 'ghost';
  const phantomPurple = '#B388FF';
  const phantomDark = '#1A0040';
  /* The first paint reads the same `--map-*` properties the recolour
     effects below push in later. Deriving them from `theme` here as well
     is what let the two drift: the effect's ghost palette was four
     distinct violets, this block's was one, and whichever ran last won. */
  const bootStyle = getComputedStyle(document.body);
  const boot = readMapPalette(name => bootStyle.getPropertyValue(name));
  const cameraColor = boot.cctv;
  const flightCom = boot.flightCivil;
  const flightPriv = boot.flightPrivate;
  const flightGov = boot.flightGov;
  const flightMil = boot.flightMilitary;

  // Create icons — TAKIP Unified Palette
  createIcon(map, 'plane-cyan', flightCom, 24);   
  createIcon(map, 'plane-green', flightPriv, 24);   
  createIcon(map, 'plane-pink', flightGov, 24);    
  createIcon(map, 'plane-red', flightMil, 24);     
  createIcon(map, 'plane-grey', boot.flightUnknown, 24);
  createDot(map, 'dot-gold', isGhost ? phantomPurple : '#D4AF37', 8);
  createDot(map, 'dot-red', isGhost ? phantomPurple : '#D32F2F', 10);
  createDot(map, 'dot-orange', isGhost ? phantomPurple : '#E65100', 10);
  createDot(map, 'dot-green', isGhost ? phantomPurple : '#26A69A', 10);
  createDot(map, 'dot-fire', isGhost ? phantomPurple : '#E65100', 10);
  createDot(map, 'dot-cctv', cameraColor, 10);

  const sources = ['flights','military','jets','private-fl','satellites','earthquakes','gdelt','day-night','cctv','fires','fire-incidents','airport-delays','chokepoint-flow','outbreaks','weather','infrastructure','maritime','maritime-choke','maritime-ships','live-news','conflict-zones', 'war-alerts-targets', 'war-alerts-lines', 'balloons', 'launches', 'aurora', 'service-status', 'gnss-interference', 'radiation', 'ip-sweep-devices', 'ip-sweep-pulse', 'ip-sweep-connections', 'scan-targets', 'sdk-entities', 'sdk-links', 'malware-nodes', 'malware-new', 'network-mesh', 'cyber-heads', 'gdelt-events', 'cf-outages', 'cf-attacks', 'alert-pins', 'wx-points'];
  sources.forEach(s => map.addSource(s, { type: 'geojson', data: EMPTY_FC }));

  // ── FLIGHT ROUTE VISUALIZATION SOURCES & LAYERS ──

  // Warning icon generator (parameterized — eliminates 3x copy-paste)
  const createWarningIcon = (id: string, color: string) => {
    const s = 20;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s/2, 1);
    ctx.lineTo(s - 1, s - 1);
    ctx.lineTo(1, s - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', s/2, s - 4);
    map.addImage(id, { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) });
  };
  createWarningIcon('warn-icon', '#D32F2F');
  createWarningIcon('warn-orange', '#E65100');
  createWarningIcon('warn-yellow', '#F9A825');

  map.addLayer({ id: 'conflict-icons', type: 'symbol', source: 'conflict-zones', layout: {
    'icon-image': ['match', ['get','severity'], 'war','warn-icon', 'high','warn-orange', 'warn-yellow'],
    'icon-size': ['interpolate',['linear'],['zoom'], 1,0.6, 4,0.8, 8,1],
    'icon-allow-overlap': true,
    'text-field': ['get','label'],
    'text-size': ['interpolate',['linear'],['zoom'], 1,7, 4,9, 8,11],
    'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.4],
    'text-allow-overlap': false,
  }, paint: {
    'text-color': ['match', ['get','severity'], 'war','#D32F2F', 'high','#E65100', '#F9A825'],
    'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
  }});


  // Day/Night
  map.addLayer({ id: 'day-night-fill', type: 'fill', source: 'day-night', paint: { 'fill-color': isGhost ? '#0D0030' : '#000022', 'fill-opacity': 0.35 }});

  // Aurora nowcast: a 1° grid of visibility probability, drawn under every point layer
  map.addLayer({ id: 'aurora-heat', type: 'heatmap', source: 'aurora', paint: {
    'heatmap-weight': ['interpolate',['linear'],['get','p'], 5,0.2, 20,0.6, 50,1],
    'heatmap-intensity': ['interpolate',['linear'],['zoom'], 1,0.8, 6,1.6],
    'heatmap-radius': ['interpolate',['exponential',2],['zoom'], 0,4, 3,12, 6,60],
    'heatmap-color': ['interpolate',['linear'],['heatmap-density'],
      0,'rgba(0,0,0,0)', 0.25,'rgba(0,230,118,0.25)', 0.55,'rgba(0,230,118,0.5)', 0.8,'rgba(124,77,255,0.65)', 1,'rgba(255,64,129,0.8)'],
    'heatmap-opacity': 0.75,
  }});

  // Earthquakes — amber threat spectrum
  map.addLayer({ id: 'eq-circles', type: 'circle', source: 'earthquakes', paint: {
    'circle-radius': ['interpolate',['linear'],['get','magnitude'], 2.5,4, 5,12, 7,24],
    'circle-color': ['interpolate',['linear'],['get','magnitude'], 2.5,'#F9A825', 4,'#E65100', 6,'#D32F2F'],
    'circle-opacity': 0.55, 'circle-blur': 0.3, 'circle-stroke-width': 1, 'circle-stroke-color': '#F9A825', 'circle-stroke-opacity': 0.25,
  }});
  map.addLayer({ id: 'eq-label', type: 'symbol', source: 'earthquakes', filter: ['>=',['get','magnitude'],4.5], layout: {
    'text-field': ['concat','M',['to-string',['get','magnitude']]], 'text-size': 9, 'text-font': ['Noto Sans Regular'], 'text-offset': [0,1.5],
  }, paint: { 'text-color': '#F9A825', 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // Fires — burnt sienna
  map.addLayer({ id: 'fires-heat', type: 'circle', source: 'fires', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,8],
    'circle-color': '#E65100', 'circle-opacity': 0.45, 'circle-blur': 0.5,
  }});

  // CCTV — outer glow ring (black/white depending on theme)
  map.addLayer({ id: 'cctv-glow', type: 'circle', source: 'cctv', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14, 14,20],
    'circle-color': '#000000', 'circle-opacity': 0.35, 'circle-blur': 1,
  }});
  // CCTV — main dot
  map.addLayer({ id: 'cctv-dots', type: 'circle', source: 'cctv', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8, 14,12],
    'circle-color': cameraColor, 'circle-opacity': 0.9,
    'circle-stroke-width': 2.5, 'circle-stroke-color': '#000000', 'circle-stroke-opacity': 0.9,
  }});
  // CCTV — labels at zoom 10+
  map.addLayer({ id: 'cctv-label', type: 'symbol', source: 'cctv', minzoom: 10, layout: {
    'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: { 'text-color': cameraColor, 'text-halo-color': '#000000', 'text-halo-width': 1.5, 'text-opacity': 0.8 }});

  // GDELT



  // ══ NETWORK INTEL — Live Malware (abuse.ch) — crimson threat ══
  map.addLayer({ id: 'malware-glow', type: 'circle', source: 'malware-nodes', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,20],
    'circle-color': '#D32F2F', 'circle-opacity': 0.06, 'circle-blur': 0.5,
  }});
  /* Sized by how many live malicious URLs the host serves. A box running
     forty payloads and one running a single sample were the same dot
     before, and they are not the same thing. */
  map.addLayer({ id: 'malware-dots', type: 'circle', source: 'malware-nodes', paint: {
    /* A zoom expression has to be the top-level input to the interpolate,
       so the activity scaling lives in the output stops rather than
       multiplying two curves together. sqrt keeps a host serving 80 URLs
       from dwarfing the map — it reads about three times the single-URL
       dot, not eighty. */
    'circle-radius': ['interpolate',['linear'],['zoom'],
      1,  ['interpolate',['linear'],['sqrt',['max',['get','url_count'],1]], 1,1.6, 3,2.4, 9,4],
      5,  ['interpolate',['linear'],['sqrt',['max',['get','url_count'],1]], 1,3.2, 3,4.8, 9,8],
      10, ['interpolate',['linear'],['sqrt',['max',['get','url_count'],1]], 1,4.8, 3,7.2, 9,12],
    ],
    'circle-color': '#D32F2F',
    'circle-opacity': 0.9,
    'circle-stroke-width': 1, 'circle-stroke-color': '#000000', 'circle-stroke-opacity': 0.8,
  }});
  /* Arrival beacon — expands and fades over the minute after a detection
     is pushed, then the feature drops out of the source entirely. */
  map.addLayer({ id: 'malware-new-ring', type: 'circle', source: 'malware-new', paint: {
    'circle-radius': 8,
    'circle-color': 'transparent',
    'circle-stroke-color': '#FF1744',
    'circle-stroke-width': 2,
    'circle-stroke-opacity': ['interpolate',['linear'],['get','age'], 0,0.9, 1,0],
  }});
  map.addLayer({ id: 'malware-label', type: 'symbol', source: 'malware-nodes', minzoom: 5, layout: {
    'text-field': ['get','malware'], 'text-size': 8, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.5], 'text-max-width': 10, 'text-allow-overlap': false,
  }, paint: { 'text-color': '#D32F2F', 'text-halo-color': '#111', 'text-halo-width': 1.5, 'text-opacity': 0.85 }});

  // ── NETWORK INTEL MESH (SDK STYLE) ──
  map.addLayer({ id: 'network-mesh-atmo', type: 'line', source: 'network-mesh', paint: {

    'line-width': ['interpolate',['linear'],['zoom'], 1, 2, 5, 4, 10, 8],
    'line-opacity': 0.08,
    'line-blur': 4,
  }});
  map.addLayer({ id: 'network-mesh-glow', type: 'line', source: 'network-mesh', paint: {

    'line-width': ['interpolate',['linear'],['zoom'], 1, 1, 5, 2, 10, 4],
    'line-opacity': 0.2,
    'line-blur': 1.5,
  }});
  map.addLayer({ id: 'network-mesh-core', type: 'line', source: 'network-mesh', paint: {

    'line-width': ['interpolate',['linear'],['zoom'], 1, 0.2, 5, 0.5, 10, 1.5],
    'line-opacity': 0.4,
  }});

  /* ══ BOTNET C2 INFRASTRUCTURE — one dot per listed server ══
     Feodo Tracker lists where a C2 is hosted and whether it still
     answers. It records no attacker, no victim and no attack, so there is
     nothing here to draw an arc between: a dot at the hosting country,
     coloured by the reported status, is the whole of what is observed. */
  map.addLayer({ id: 'cyber-heads', type: 'circle', source: 'cyber-heads', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,2.5, 5,4, 10,6],
    'circle-color': ['case', ['==', ['get','status'], 'online'], '#FF6D00', '#555555'],
    'circle-opacity': 0.95,
    'circle-stroke-width': 1.5, 'circle-stroke-color': '#333', 'circle-stroke-opacity': 0.9,
  }});
  map.addLayer({ id: 'cyber-labels', type: 'symbol', source: 'cyber-heads', minzoom: 3, layout: {
    'text-field': ['get','malware'], 'text-size': 9, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.5], 'text-max-width': 10, 'text-allow-overlap': false,
  }, paint: { 'text-color': '#333333', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.85 }});

  map.addLayer({ id: 'gdelt-dots', type: 'circle', source: 'gdelt', paint: {
    'circle-radius': 4, 'circle-color': '#D32F2F', 'circle-opacity': 0.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#D32F2F', 'circle-stroke-opacity': 0.25,
  }});

  /* ── GDELT 2.0 Events — one marker per story, sized by how many distinct
     reports carry it. State and province centroids draw as faint rings. ── */
  const gdeltColor: LayerColor = ['match', ['get', 'family'],
    'violence', GDELT_FAMILY_COLOR.violence,
    'protest', GDELT_FAMILY_COLOR.protest,
    'tension', GDELT_FAMILY_COLOR.tension,
    'cooperation', GDELT_FAMILY_COLOR.cooperation,
    '#9B978E'];
  map.addLayer({ id: 'gdelt-events-dots', type: 'circle', source: 'gdelt-events',
    layout: { 'circle-sort-key': ['get', 'reports'] },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'reports'], 1, 4, 2, 6, 4, 8, 8, 11, 16, 14],
      'circle-color': gdeltColor,
      'circle-opacity': ['match', ['get', 'precision'], 'region', 0.25, 0.8],
      'circle-stroke-width': ['match', ['get', 'precision'], 'region', 1.5, 1],
      'circle-stroke-color': ['match', ['get', 'precision'], 'region', gdeltColor, '#000000'],
      'circle-stroke-opacity': 0.7,
    },
  });

  /* ── Cloudflare Radar — internet outages (country-scoped) ── */
  map.addLayer({ id: 'cf-outage-halo', type: 'circle', source: 'cf-outages', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,14, 5,26, 10,40],
    'circle-color': '#FFB300', 'circle-opacity': 0.12, 'circle-blur': 0.9,
  }});
  map.addLayer({ id: 'cf-outage-dots', type: 'circle', source: 'cf-outages', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,9],
    // Resolved outages read cooler than ongoing ones.
    'circle-color': ['case',['get','ongoing'],'#FFB300','#8B7325'],
    'circle-opacity': 0.9,
    'circle-stroke-width': 1.5, 'circle-stroke-color': '#000000', 'circle-stroke-opacity': 0.7,
  }});
  map.addLayer({ id: 'cf-outage-label', type: 'symbol', source: 'cf-outages', minzoom: 3, layout: {
    'text-field': ['get','country_name'], 'text-size': 9, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.4], 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: { 'text-color': '#FFB300', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.85 }});

  /* ── Cloudflare Radar — layer-3 attack origin share ── */
  map.addLayer({ id: 'cf-attack-dots', type: 'circle', source: 'cf-attacks', paint: {
    'circle-radius': ['interpolate',['linear'],['get','share'], 0,4, 5,9, 20,16, 50,24],
    'circle-color': '#FF3D3D', 'circle-opacity': 0.35, 'circle-blur': 0.3,
    'circle-stroke-width': 1, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.7,
  }});
  map.addLayer({ id: 'cf-attack-label', type: 'symbol', source: 'cf-attacks', minzoom: 2, layout: {
    'text-field': ['concat',['get','country'],' ',['to-string',['get','share']],'%'],
    'text-size': 9, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.6], 'text-allow-overlap': false,
  }, paint: { 'text-color': '#FF6B6B', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9 }});

  // Likely GNSS interference: 2° cells shaded by the share of aircraft reporting degraded accuracy
  map.addLayer({ id: 'gnss-fill', type: 'fill', source: 'gnss-interference', paint: {
    'fill-color': ['interpolate',['linear'],['get','ratio'], 0.1,'#FFB300', 0.3,'#FF6D00', 0.6,'#D50000'],
    'fill-opacity': 0.35,
  }});
  map.addLayer({ id: 'gnss-line', type: 'line', source: 'gnss-interference', paint: {
    'line-color': '#FF6D00', 'line-width': 1, 'line-opacity': 0.6,
  }});

  // Vendor status-page incidents, one pin per HQ city
  map.addLayer({ id: 'service-status-dots', type: 'circle', source: 'service-status', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,11],
    'circle-color': ['match', ['get','worst'], 'critical','#FF1744', 'major','#FF1744', 'minor','#FF9500', 'maintenance','#4FC3F7', '#9E9E9E'],
    'circle-opacity': 0.85, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#0C0E1A',
  }});
  map.addLayer({ id: 'service-status-label', type: 'symbol', source: 'service-status', minzoom: 2, layout: {
    'text-field': ['concat', ['get','city'], ' · ', ['to-string', ['get','count']]],
    'text-size': 9, 'text-font': ['Noto Sans Regular'], 'text-offset': [0, 1.4], 'text-allow-overlap': false,
  }, paint: { 'text-color': '#B0BEC5', 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // Weather Events (NASA EONET) — deep violet
  map.addLayer({ id: 'weather-glow', type: 'circle', source: 'weather', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,20, 10,30],
    'circle-color': '#7E57C2', 'circle-opacity': 0.08, 'circle-blur': 1,
  }});
  map.addLayer({ id: 'weather-dots', type: 'circle', source: 'weather', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14],
    'circle-color': ['match', ['get','icon'], 'volcano','#D32F2F', 'alert','#FF6D00', ['match', ['get','severity'], 'high','#D500F9', 'medium','#9C6ADE', '#6A5A9A']],
    'circle-opacity': 0.75,
    'circle-stroke-width': 1.5, 'circle-stroke-color': '#7E57C2', 'circle-stroke-opacity': 0.35,
  }});
  map.addLayer({ id: 'weather-label', type: 'symbol', source: 'weather', layout: {
    'text-field': ['get','title'], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: { 'text-color': '#7E57C2', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

  // Nuclear Infrastructure — teal / amber risk
  map.addLayer({ id: 'infra-glow', type: 'circle', source: 'infrastructure', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
    'circle-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100', '#26A69A'],
    'circle-opacity': 0.08, 'circle-blur': 1,
  }});
  map.addLayer({ id: 'infra-dots', type: 'circle', source: 'infrastructure', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
    'circle-color': ['case', 
      ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100',
      ['==', ['get','status'], 'Active Conflict Zone'], '#D32F2F', 
      ['in', 'Decommission', ['get', 'status']], '#546E7A', 
      ['==', ['get','status'], 'Under Construction'], '#FFA726', 
      '#26A69A'
    ],
    'circle-opacity': 0.75,
    'circle-stroke-width': 1.5, 'circle-stroke-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100', '#26A69A'], 'circle-stroke-opacity': 0.35,
  }});
  map.addLayer({ id: 'infra-label', type: 'symbol', source: 'infrastructure', minzoom: 5, layout: {
    'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: { 'text-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100', '#26A69A'], 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

  // Satellites.
  // Every satellite is drawn once, by the custom 3D layer below, at its
  // altitude. These two circle layers are kept defined — the source feeds
  // the 3D layer and other code refers to them — but hidden: drawing the
  // same satellite both flat on the ground and again up at altitude is
  // what made the map read as half 2D and half 3D.
  // Hit-testing is handled by the 3D layer's own GPU pick pass, since
  // queryRenderedFeatures cannot see into a custom WebGL layer.
  map.addLayer({ id: 'sat-glow', type: 'circle', source: 'satellites', layout: { visibility: 'none' }, paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,6], 'circle-color': ['get','color'], 'circle-opacity': 0.3, 'circle-blur': 1,
  }});
  map.addLayer({ id: 'sat-dots', type: 'circle', source: 'satellites', layout: { visibility: 'none' }, paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.5, 5,3], 'circle-color': ['get','color'], 'circle-opacity': 1.0,
  }});
  // The spacecraft themselves, lifted to their orbit.
  if (!map.getLayer('sat-3d')) {
    satLayerRef.current = createSatelliteLayer('sat-3d');
    map.addLayer(satLayerRef.current as any);
  }

  // Maritime — ports & naval bases — ocean teal
  map.addLayer({ id: 'maritime-glow', type: 'circle', source: 'maritime', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,20],
    'circle-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'],
    'circle-opacity': 0.08, 'circle-blur': 1,
  }});
  map.addLayer({ id: 'maritime-dots', type: 'circle', source: 'maritime', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,9],
    'circle-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'],
    'circle-opacity': 0.8,
    'circle-stroke-width': 1.5, 'circle-stroke-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'], 'circle-stroke-opacity': 0.35,
  }});
  map.addLayer({ id: 'maritime-label', type: 'symbol', source: 'maritime', minzoom: 4, layout: {
    'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: { 'text-color': '#26C6DA', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

  // Maritime chokepoints — amber threat spectrum
  map.addLayer({ id: 'choke-glow', type: 'circle', source: 'maritime-choke', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,18, 10,28],
    'circle-color': '#E65100', 'circle-opacity': 0.1, 'circle-blur': 1,
  }});
  map.addLayer({ id: 'choke-dots', type: 'circle', source: 'maritime-choke', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,12],
    'circle-color': ['match', ['get','risk'], 'CRITICAL','#D32F2F', 'HIGH','#E65100', 'ELEVATED','#F9A825', '#26A69A'],
    'circle-opacity': 0.85,
    'circle-stroke-width': 1.5, 'circle-stroke-color': '#E65100', 'circle-stroke-opacity': 0.4,
  }});
  map.addLayer({ id: 'choke-label', type: 'symbol', source: 'maritime-choke', minzoom: 3, layout: {
    'text-field': ['get','name'], 'text-size': 10, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: { 'text-color': '#E65100', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.9 }});

  // Live News — muted rose
  map.addLayer({ id: 'news-glow', type: 'circle', source: 'live-news', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
    'circle-color': '#EC407A', 'circle-opacity': 0.08, 'circle-blur': 1,
  }});
  map.addLayer({ id: 'news-dots', type: 'circle', source: 'live-news', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
    'circle-color': '#EC407A', 'circle-opacity': 0.8,
    'circle-stroke-width': 1.5, 'circle-stroke-color': '#EC407A', 'circle-stroke-opacity': 0.4,
  }});
  map.addLayer({ id: 'news-label', type: 'symbol', source: 'live-news', minzoom: 4, layout: {
    'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: { 'text-color': '#EC407A', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

  // Live Alert pins — a report at the place it names, coloured by what it describes
  const alertColor: LayerColor = ['match', ['get','kind'], 'rocket', ALERT_KINDS.rocket.color, 'event', ALERT_KINDS.event.color, ALERT_KINDS.news.color];
  map.addLayer({ id: 'alert-pin-glow', type: 'circle', source: 'alert-pins', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,7, 6,14, 10,22],
    'circle-color': alertColor, 'circle-opacity': 0.16, 'circle-blur': 0.8,
  }});
  map.addLayer({ id: 'alert-pin-dots', type: 'circle', source: 'alert-pins', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,3.5, 6,6, 10,8],
    'circle-color': alertColor,
    // A region is placed less exactly than a town, so it is drawn as a ring.
    'circle-opacity': ['case', ['==', ['get','precision'], 'region'], 0.15, 0.95],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': ['match', ['get','precision'], 'region', alertColor, '#0A0A0A'] as LayerColor,
  }});
  // A report just in, and the pin a popup is open on, each get a ring.
  map.addLayer({ id: 'alert-pin-pulse', type: 'circle', source: 'alert-pins', filter: ['==', ['get','fresh'], true], paint: {
    'circle-radius': 9, 'circle-color': 'transparent',
    'circle-stroke-color': alertColor as never, 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.7,
  }});
  map.addLayer({ id: 'alert-pin-selected', type: 'circle', source: 'alert-pins', filter: ['==', ['get','id'], ''], paint: {
    'circle-radius': 13, 'circle-color': 'transparent',
    'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.85,
  }});
  map.addLayer({ id: 'alert-pin-label', type: 'symbol', source: 'alert-pins', minzoom: 5, layout: {
    // "Riyadh ·3" when three reports name the same town.
    'text-field': ['case', ['>', ['get','stack'], 1],
      ['concat', ['get','place_name'], ' ·', ['to-string', ['get','stack']]],
      ['get','place_name']],
    'text-size': 10, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: { 'text-color': alertColor, 'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.9 }});

  // ══ IP SWEEP — Neighborhood device visualization ══
  map.addLayer({ id: 'sweep-connections', type: 'line', source: 'ip-sweep-connections', paint: {
    'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.3, 'line-dasharray': [2, 4],
  }});
  map.addLayer({ id: 'sweep-pulse-ring', type: 'circle', source: 'ip-sweep-pulse', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 8,40, 12,80, 16,160],
    'circle-color': 'transparent', 'circle-opacity': 0.6,
    'circle-stroke-width': 2, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.4,
  }});
  map.addLayer({ id: 'sweep-device-glow', type: 'circle', source: 'ip-sweep-devices', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 8,8, 12,16, 16,30],
    'circle-color': ['get', 'color'], 'circle-opacity': 0.15, 'circle-blur': 1,
  }});
  map.addLayer({ id: 'sweep-device-dots', type: 'circle', source: 'ip-sweep-devices', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 8,3, 12,6, 16,10],
    'circle-color': ['get', 'color'], 'circle-opacity': 0.95,
    'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.6,
  }});
  map.addLayer({ id: 'sweep-device-labels', type: 'symbol', source: 'ip-sweep-devices', minzoom: 13, layout: {
    'text-field': ['concat', ['get', 'device_type'], '\n', ['get', 'ip']],
    'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 2.2], 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: {
    'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
  }});

  // ══ SCAN TARGETS — Geolocated individual scans ══
  map.addLayer({ id: 'scan-targets-glow', type: 'circle', source: 'scan-targets', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,25, 10,40],
    'circle-color': '#D32F2F', 'circle-opacity': 0.15, 'circle-blur': 1,
  }});
  map.addLayer({ id: 'scan-targets-dots', type: 'circle', source: 'scan-targets', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,12],
    'circle-color': '#D32F2F', 'circle-opacity': 0.9,
    'circle-stroke-width': 1.5, 'circle-stroke-color': '#ECEFF1', 'circle-stroke-opacity': 0.7,
  }});
  map.addLayer({ id: 'scan-targets-label', type: 'symbol', source: 'scan-targets', layout: {
    'text-field': ['get', 'id'], 'text-size': 11, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: { 'text-color': '#D32F2F', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9 }});

  // Selected aircraft's route, under the aircraft so the icon sits on its line.
  map.addSource('selected-flight', { type: 'geojson', data: EMPTY_FC });
  map.addLayer({ id: 'sel-flight-flown', type: 'line', source: 'selected-flight', filter: ['==', ['get', 'kind'], 'flown'],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#7FE9FF', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.5, 6, 2.5, 10, 3.5], 'line-opacity': 0.9 } });
  map.addLayer({ id: 'sel-flight-ahead', type: 'line', source: 'selected-flight', filter: ['==', ['get', 'kind'], 'ahead'],
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#7FE9FF', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 6, 1.8, 10, 2.5], 'line-opacity': 0.6, 'line-dasharray': [2, 2] } });
  map.addLayer({ id: 'sel-flight-airport', type: 'circle', source: 'selected-flight', filter: ['==', ['get', 'kind'], 'airport'],
    paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 2, 'circle-stroke-color': '#FFB300' } });
  map.addLayer({ id: 'sel-flight-airport-label', type: 'symbol', source: 'selected-flight', filter: ['==', ['get', 'kind'], 'airport'],
    layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.6], 'text-allow-overlap': true },
    paint: { 'text-color': '#FFB300', 'text-halo-color': '#0C0E1A', 'text-halo-width': 1.5 } });

  // Flight layers (WebGL symbol — GPU rendered, handles 50K+ smooth)
  const flightLayers = [
    { id: 'fl-commercial', src: 'flights', icon: 'plane-cyan' },
    { id: 'fl-private', src: 'private-fl', icon: 'plane-green' },
    { id: 'fl-jets', src: 'jets', icon: 'plane-pink' },
    { id: 'fl-military', src: 'military', icon: 'plane-red' },
  ];
  flightLayers.forEach(l => {
    map.addLayer({ id: l.id, type: 'symbol', source: l.src, layout: {
      'icon-image': l.icon, 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.7, 10,1],
      'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
    }, paint: { 'icon-opacity': 0.85 }});
  });

  // Upcoming launches, one pin per pad: green once LL2 says Go
  map.addLayer({ id: 'launch-dots', type: 'circle', source: 'launches', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,8],
    'circle-color': ['match', ['get','status'], 'Go','#00E676', 'Hold','#FF9500', '#4FC3F7'],
    'circle-opacity': 0.9,
    'circle-stroke-width': 1.5, 'circle-stroke-color': '#0C0E1A',
  }});
  map.addLayer({ id: 'launch-label', type: 'symbol', source: 'launches', minzoom: 3, layout: {
    'text-field': ['get','when'], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.3], 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: { 'text-color': '#B0BEC5', 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // Balloons (moving entities)
  map.addLayer({ id: 'balloon-dots', type: 'circle', source: 'balloons', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,7],
    'circle-color': ['get', 'color'],
    'circle-opacity': 0.8,
    'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.5,
  }});
  map.addLayer({ id: 'balloon-label', type: 'symbol', source: 'balloons', minzoom: 4, layout: {
    'text-field': ['get','callsign'], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.2], 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // Radiation — violet when within its own week's range (or unrated), amber/orange above it, grey once silent
  const RAD_COLOR: LayerColor = ['match', ['get','status'], 'SPIKE','#E65100', 'ELEVATED','#FFB300', 'OFFLINE','#5C5A54', 'UNRATED','#9575CD', '#7E57C2'];
  map.addLayer({ id: 'rad-glow', type: 'circle', source: 'radiation', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,20, 10,40],
    'circle-color': RAD_COLOR,
    'circle-opacity': 0.12, 'circle-blur': 1,
  }});
  map.addLayer({ id: 'rad-dots', type: 'circle', source: 'radiation', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,8],
    'circle-color': RAD_COLOR,
    'circle-opacity': 0.85,
    'circle-stroke-width': 1.5, 'circle-stroke-color': RAD_COLOR, 'circle-stroke-opacity': 0.35,
  }});
  map.addLayer({ id: 'rad-label', type: 'symbol', source: 'radiation', minzoom: 5, layout: {
    'text-field': ['concat', ['to-string', ['get','reading']], ' nSv/h'], 'text-size': 9, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.5], 'text-allow-overlap': false,
  }, paint: { 'text-color': RAD_COLOR, 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // War and air-raid alerts — full strength while the siren or oblast alert stands, faint once it has ended
  map.addLayer({ id: 'war-alert-glow', type: 'circle', source: 'war-alerts-targets', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1, ['match',['get','precision'],'oblast',14,8], 6, ['match',['get','precision'],'oblast',40,18]],
    'circle-color': ['get','color'],
    'circle-opacity': ['case', ['==',['get','active'],true], 0.22, 0.06], 'circle-blur': 1,
  }});
  map.addLayer({ id: 'war-alert-dots', type: 'circle', source: 'war-alerts-targets', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,3.5, 6,6, 10,8],
    'circle-color': ['get','color'],
    'circle-opacity': ['case', ['==',['get','active'],true], 0.95, 0.4],
    'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': ['case', ['==',['get','active'],true], 0.7, 0.2],
  }});
  map.addLayer({ id: 'war-alert-label', type: 'symbol', source: 'war-alerts-targets', minzoom: 4, layout: {
    'text-field': ['get','place'], 'text-size': 9, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.3], 'text-allow-overlap': false,
  }, paint: { 'text-color': ['get','color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // Agency-reported wildfires (CWFIS) over the FIRMS hotspots — sized by burned area, coloured by stage of control
  map.addLayer({ id: 'fire-incident-dots', type: 'circle', source: 'fire-incidents', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 2, ['interpolate',['linear'],['get','size'], 0,2.5, 10000,6, 100000,9], 8, ['interpolate',['linear'],['get','size'], 0,5, 10000,12, 100000,18]],
    'circle-color': ['get','color'], 'circle-opacity': 0.85,
    'circle-stroke-width': 1.2, 'circle-stroke-color': '#000', 'circle-stroke-opacity': 0.6,
  }});
  map.addLayer({ id: 'fire-incident-label', type: 'symbol', source: 'fire-incidents', minzoom: 6, layout: {
    'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.4], 'text-allow-overlap': false,
  }, paint: { 'text-color': ['get','color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // FAA airport delay programmes — one pin per airport at its worst programme
  map.addLayer({ id: 'airport-delay-dots', type: 'circle', source: 'airport-delays', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 2,5, 6,8, 10,11],
    'circle-color': ['get','color'], 'circle-opacity': 0.9,
    'circle-stroke-width': 2, 'circle-stroke-color': '#0C0E1A', 'circle-stroke-opacity': 0.9,
  }});
  map.addLayer({ id: 'airport-delay-label', type: 'symbol', source: 'airport-delays', minzoom: 3, layout: {
    'text-field': ['get','code'], 'text-size': 9, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.3], 'text-allow-overlap': false,
  }, paint: { 'text-color': ['get','color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // PortWatch chokepoint traffic — rings, so they sit apart from the static chokepoint markers
  map.addLayer({ id: 'chokepoint-flow-ring', type: 'circle', source: 'chokepoint-flow', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,7, 5,13, 9,20],
    'circle-color': 'rgba(0,0,0,0)',
    'circle-stroke-width': ['case', ['==',['get','status'],'disrupted'], 3, 2], 'circle-stroke-color': ['get','color'], 'circle-stroke-opacity': 0.9,
  }});
  map.addLayer({ id: 'chokepoint-flow-label', type: 'symbol', source: 'chokepoint-flow', minzoom: 3, layout: {
    'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 2], 'text-allow-overlap': false,
  }, paint: { 'text-color': ['get','color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // Outbreak notices — a soft ring at the country centroid, never a pin: the issuers name countries, not places
  map.addLayer({ id: 'outbreak-rings', type: 'circle', source: 'outbreaks', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1, ['+', 8, ['*', 2, ['get','count']]], 5, ['+', 22, ['*', 4, ['get','count']]]],
    'circle-color': ['get','color'], 'circle-opacity': 0.1,
    'circle-stroke-width': 1.5, 'circle-stroke-color': ['get','color'], 'circle-stroke-opacity': 0.8,
  }});
  map.addLayer({ id: 'outbreak-label', type: 'symbol', source: 'outbreaks', minzoom: 2.5, layout: {
    'text-field': ['get','label'], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: { 'text-color': ['get','color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

  // ══ TAKIP SDK — Lattice Intelligence Mesh ══
  // Polybolos Style: Delicate, translucent, steel-blue splined mesh

  // ── SEA domain (Distinct Solid Lines) ──
  // Removed glow to match the clean, diagrammatic look of submarinecablemap.com
  map.addLayer({ id: 'sdk-sea', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'SEA'], paint: {
    'line-color': ['coalesce', ['get', 'color'], '#1976D2'], // Single solid color from properties
    'line-width': ['interpolate',['linear'],['zoom'], 1, 0.8, 5, 1.5, 10, 2.5],
    'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 0.5, 10, 0.7],
  }});

  // ── AIR domain (Steel Gray / Cyan) ──
  map.addLayer({ id: 'sdk-air-atmo', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
    'line-color': '#4DD0E1',
    'line-width': ['interpolate',['linear'],['zoom'], 1, 1.5, 5, 5, 10, 8],
    'line-opacity': 0.04,
    'line-blur': 3,
  }});
  map.addLayer({ id: 'sdk-air-glow', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
    'line-color': '#80DEEA',
    'line-width': ['interpolate',['linear'],['zoom'], 1, 0.8, 5, 2, 10, 4],
    'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.08, 5, 0.12, 10, 0.18],
    'line-blur': 1,
  }});
  map.addLayer({ id: 'sdk-air', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
    'line-color': '#B2EBF2',
    'line-width': ['interpolate',['linear'],['zoom'], 1, 0.15, 5, 0.6, 10, 1.2],
    'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.2, 5, 0.35, 10, 0.5],
  }});

  // ── INTEL domain (Deep Steel / Violet) ──
  map.addLayer({ id: 'sdk-intel-atmo', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
    'line-color': '#7986CB',
    'line-width': ['interpolate',['linear'],['zoom'], 1, 2.5, 5, 7, 10, 12],
    'line-opacity': 0.06,
    'line-blur': 5,
  }});
  map.addLayer({ id: 'sdk-intel-glow', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
    'line-color': '#9FA8DA',
    'line-width': ['interpolate',['linear'],['zoom'], 1, 1.2, 5, 3, 10, 6],
    'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.12, 5, 0.18, 10, 0.25],
    'line-blur': 2,
  }});
  map.addLayer({ id: 'sdk-intel', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
    'line-color': '#C5CAE9',
    'line-width': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 1, 10, 2],
    'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 0.45, 10, 0.7],
  }});

  // Weather grid (Open-Meteo) — wind arrows and temperature readings; the field itself is a raster, see below.
  if (!map.hasImage('wx-arrow')) {
    const w = 16, h = 28, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(w / 2 - 1.5, 9, 3, h - 11);
    ctx.beginPath(); ctx.moveTo(w / 2, 1); ctx.lineTo(w - 2, 12); ctx.lineTo(2, 12); ctx.closePath(); ctx.fill();
    map.addImage('wx-arrow', { width: w, height: h, data: new Uint8Array(ctx.getImageData(0, 0, w, h).data) }, { sdf: true });
  }
  map.addLayer({ id: 'wx-wind', type: 'symbol', source: 'wx-points', filter: ['!=', ['get','wind'], null], layout: {
    'icon-image': 'wx-arrow',
    // Meteorological direction is where the wind comes from; the arrow points where it goes.
    'icon-rotate': ['+', ['coalesce', ['get','windDir'], 0], 180], 'icon-rotation-alignment': 'map',
    'icon-size': ['interpolate',['linear'],['zoom'],
      1, ['interpolate',['linear'],['get','wind'], 0,0.35, 60,0.75],
      5, ['interpolate',['linear'],['get','wind'], 0,0.6, 60,1.2]],
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
  }, paint: {
    'icon-color': ['interpolate',['linear'],['get','wind'], 0,'#E1F5FE', 15,'#81D4FA', 30,'#FFF176', 50,'#FFB74D', 75,'#E57373', 100,'#D81B60'],
    'icon-opacity': 0.9,
  }});
  map.addLayer({ id: 'wx-temp-label', type: 'symbol', source: 'wx-points', filter: ['!=', ['get','temp'], null], layout: {
    'text-field': ['concat', ['to-string', ['round', ['get','temp']]], '°'],
    'text-size': ['interpolate',['linear'],['zoom'], 1,9, 5,12],
    'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.3], 'text-allow-overlap': false,
  }, paint: { 'text-color': '#FFFFFF', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.4 }});

  // Maritime Ships — coloured by vessel class; arrows take over once headings are legible.
  if (!map.hasImage('ship-arrow')) {
    const s = 24, c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(s / 2, 2); ctx.lineTo(s - 5, s - 3); ctx.lineTo(s / 2, s - 8); ctx.lineTo(5, s - 3); ctx.closePath(); ctx.fill();
    map.addImage('ship-arrow', { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) }, { sdf: true });
  }
  const shipColorExpr = ['match', ['get','type'], ...shipColorArms(), SHIP_FALLBACK_COLOR] as unknown as CirclePaint['circle-color'];
  map.addLayer({ id: 'ship-dots', type: 'circle', source: 'maritime-ships', maxzoom: 6, paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.3, 4,2.4, 6,3.5],
    'circle-color': shipColorExpr,
    'circle-opacity': 0.8,
  }});
  map.addLayer({ id: 'ship-arrows', type: 'symbol', source: 'maritime-ships', minzoom: 6, layout: {
    'icon-image': 'ship-arrow',
    'icon-size': ['interpolate',['linear'],['zoom'], 6,0.5, 10,0.8, 14,1.1],
    'icon-rotate': ['coalesce', ['get','heading'], 0], 'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
  }, paint: { 'icon-color': shipColorExpr }});
  map.addLayer({ id: 'ship-label', type: 'symbol', source: 'maritime-ships', minzoom: 8, layout: {
    'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.2], 'text-allow-overlap': false,
  }, paint: { 'text-color': shipColorExpr, 'text-halo-color': '#000', 'text-halo-width': 1 }});
}
