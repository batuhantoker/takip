import type * as maplibregl from 'maplibre-gl';
import { HAS_COURSE } from '@/lib/map/course';
import { addCctvLayers, addCctvSource } from '@/lib/cameras/map-layers';
import { readMapPalette } from '@/lib/map/palette';
import { LABEL_SIZE, MAP_INK, MARKER_STROKE, labelPaint, markerRadius } from '@/lib/map/tokens';
import { createSatelliteLayer } from '@/lib/satellites/layer';
import { SHIP_FALLBACK_COLOR, shipColorArms } from '@/lib/ships/filter';

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
  // A dark rim, half of it under the fill: lost on the dark map, an edge on imagery.
  ctx.strokeStyle = 'rgba(10,12,15,0.85)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
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

  addCctvSource(map);
  const sources = ['flights','military','jets','private-fl','satellites','earthquakes','gdelt','day-night','fires','fire-incidents','airport-delays','chokepoint-flow','outbreaks','weather','infrastructure','maritime','maritime-choke','maritime-ships','live-news','conflict-zones', 'war-alerts-targets', 'war-alerts-lines', 'balloons', 'launches', 'aurora', 'service-status', 'gnss-interference', 'radiation', 'ip-sweep-devices', 'ip-sweep-pulse', 'ip-sweep-connections', 'scan-targets', 'sdk-entities', 'sdk-links', 'malware-nodes', 'malware-new', 'cyber-heads', 'gdelt-events', 'cf-outages', 'cf-attacks', 'alert-pins', 'wx-points'];
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
  createWarningIcon('warn-icon', MAP_INK.red);
  createWarningIcon('warn-orange', MAP_INK.amber);
  createWarningIcon('warn-yellow', MAP_INK.sand);

  map.addLayer({ id: 'conflict-icons', type: 'symbol', source: 'conflict-zones', layout: {
    'icon-image': ['match', ['get','severity'], 'war','warn-icon', 'high','warn-orange', 'warn-yellow'],
    'icon-size': ['interpolate',['linear'],['zoom'], 1,0.5, 4,0.65, 8,0.85],
    'icon-allow-overlap': true,
    'text-field': ['step', ['zoom'], '', 3, ['get','label']],
    'text-size': LABEL_SIZE,
    'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.2],
    'text-anchor': 'top',
    'text-optional': true,
    'text-allow-overlap': false,
  }, paint: labelPaint() });


  // Day/Night
  map.addLayer({ id: 'day-night-fill', type: 'fill', source: 'day-night', paint: { 'fill-color': isGhost ? '#0D0030' : MAP_INK.surface0, 'fill-opacity': 0.32 }});

  // Aurora nowcast: a 1° grid of visibility probability, drawn under every point layer
  map.addLayer({ id: 'aurora-heat', type: 'heatmap', source: 'aurora', paint: {
    'heatmap-weight': ['interpolate',['linear'],['get','p'], 5,0.2, 20,0.6, 50,1],
    'heatmap-intensity': ['interpolate',['linear'],['zoom'], 1,0.8, 6,1.6],
    'heatmap-radius': ['interpolate',['exponential',2],['zoom'], 0,4, 3,12, 6,60],
    'heatmap-color': ['interpolate',['linear'],['heatmap-density'],
      0,'rgba(0,0,0,0)', 0.25,'rgba(0,230,118,0.25)', 0.55,'rgba(0,230,118,0.5)', 0.8,'rgba(124,77,255,0.65)', 1,'rgba(255,64,129,0.8)'],
    'heatmap-opacity': 0.75,
  }});

  // Earthquakes: a ring sized and warmed by magnitude
  const eqColor: LayerColor = ['interpolate',['linear'],['get','magnitude'], 2.5,MAP_INK.sand, 4.5,MAP_INK.amber, 6,MAP_INK.red];
  map.addLayer({ id: 'eq-circles', type: 'circle', source: 'earthquakes', paint: {
    'circle-radius': ['interpolate',['linear'],['get','magnitude'], 2.5,2.5, 4,4, 5,6, 6,9, 7,13],
    'circle-color': eqColor, 'circle-opacity': 0.28,
    'circle-stroke-width': 1, 'circle-stroke-color': eqColor, 'circle-stroke-opacity': 0.85,
  }});
  map.addLayer({ id: 'eq-label', type: 'symbol', source: 'earthquakes', minzoom: 2, filter: ['>=',['get','magnitude'],4.5], layout: {
    'text-field': ['concat','M',['to-string',['get','magnitude']]], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Fires
  map.addLayer({ id: 'fires-heat', type: 'circle', source: 'fires', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.5, 6,2.5, 10,4, 14,6],
    'circle-color': '#DB7B48', 'circle-opacity': 0.6,
  }});

  addCctvLayers(map, cameraColor);

  // GDELT



  // ══ NETWORK INTEL — Live Malware (abuse.ch) ══
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
    'circle-color': MAP_INK.red,
    'circle-opacity': 0.85,
    ...MARKER_STROKE,
  }});
  /* Arrival beacon — expands and fades over the minute after a detection
     is pushed, then the feature drops out of the source entirely. */
  map.addLayer({ id: 'malware-new-ring', type: 'circle', source: 'malware-new', paint: {
    'circle-radius': 8,
    'circle-color': 'transparent',
    'circle-stroke-color': MAP_INK.red,
    'circle-stroke-width': 1.5,
    'circle-stroke-opacity': ['interpolate',['linear'],['get','age'], 0,0.9, 1,0],
  }});
  map.addLayer({ id: 'malware-label', type: 'symbol', source: 'malware-nodes', minzoom: 6, layout: {
    'text-field': ['get','malware'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 10, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  /* ══ BOTNET C2 INFRASTRUCTURE — one dot per listed server ══
     Feodo Tracker lists where a C2 is hosted and whether it still
     answers. It records no attacker, no victim and no attack, so there is
     nothing here to draw an arc between: a dot at the hosting country,
     coloured by the reported status, is the whole of what is observed. */
  map.addLayer({ id: 'cyber-heads', type: 'circle', source: 'cyber-heads', paint: {
    'circle-radius': markerRadius(2.5, 4, 5.5),
    'circle-color': ['case', ['==', ['get','status'], 'online'], MAP_INK.amber, MAP_INK.ink3],
    'circle-opacity': 0.9,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'cyber-labels', type: 'symbol', source: 'cyber-heads', minzoom: 4, layout: {
    'text-field': ['get','malware'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 10, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  map.addLayer({ id: 'gdelt-dots', type: 'circle', source: 'gdelt', paint: {
    'circle-radius': markerRadius(2, 3.5, 5), 'circle-color': MAP_INK.red, 'circle-opacity': 0.7, ...MARKER_STROKE,
  }});

  /* ── GDELT 2.0 Events — one marker per story, sized by how many distinct
     reports carry it. State and province centroids draw as faint rings. ── */
  // Same tones as the GDELT popup's kicker dot.
  const gdeltColor: LayerColor = ['match', ['get', 'family'],
    'violence', MAP_INK.red,
    'protest', MAP_INK.violet,
    'tension', MAP_INK.amber,
    'cooperation', MAP_INK.green,
    MAP_INK.ink3];
  map.addLayer({ id: 'gdelt-events-dots', type: 'circle', source: 'gdelt-events',
    layout: { 'circle-sort-key': ['get', 'reports'] },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'reports'], 1, 3, 2, 4.5, 4, 6, 8, 8, 16, 10],
      'circle-color': gdeltColor,
      'circle-opacity': ['match', ['get', 'precision'], 'region', 0.15, 0.8],
      'circle-stroke-width': 1,
      'circle-stroke-color': ['match', ['get', 'precision'], 'region', gdeltColor, MAP_INK.surface0],
      'circle-stroke-opacity': 0.75,
    },
  });

  /* ── Cloudflare Radar — internet outages (country-scoped) ── */
  map.addLayer({ id: 'cf-outage-dots', type: 'circle', source: 'cf-outages', paint: {
    'circle-radius': markerRadius(3.5, 5, 7),
    // Resolved outages read cooler than ongoing ones.
    'circle-color': ['case',['get','ongoing'],MAP_INK.amber,MAP_INK.ink3],
    'circle-opacity': 0.9,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'cf-outage-label', type: 'symbol', source: 'cf-outages', minzoom: 3, layout: {
    'text-field': ['get','country_name'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  /* ── Cloudflare Radar — layer-3 attack origin share ── */
  map.addLayer({ id: 'cf-attack-dots', type: 'circle', source: 'cf-attacks', paint: {
    'circle-radius': ['interpolate',['linear'],['get','share'], 0,3, 5,6, 20,11, 50,16],
    'circle-color': MAP_INK.red, 'circle-opacity': 0.22,
    'circle-stroke-width': 1, 'circle-stroke-color': MAP_INK.red, 'circle-stroke-opacity': 0.75,
  }});
  map.addLayer({ id: 'cf-attack-label', type: 'symbol', source: 'cf-attacks', minzoom: 2, layout: {
    'text-field': ['concat',['get','country'],' ',['to-string',['get','share']],'%'],
    'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Likely GNSS interference: 2° cells shaded by the share of aircraft reporting degraded accuracy
  map.addLayer({ id: 'gnss-fill', type: 'fill', source: 'gnss-interference', paint: {
    'fill-color': ['interpolate',['linear'],['get','ratio'], 0.1,MAP_INK.sand, 0.3,MAP_INK.amber, 0.6,MAP_INK.red],
    'fill-opacity': 0.24,
  }});
  map.addLayer({ id: 'gnss-line', type: 'line', source: 'gnss-interference', paint: {
    'line-color': MAP_INK.amber, 'line-width': 0.5, 'line-opacity': 0.45,
  }});

  // Vendor status-page incidents, one pin per HQ city
  map.addLayer({ id: 'service-status-dots', type: 'circle', source: 'service-status', paint: {
    'circle-radius': markerRadius(3.5, 5, 7),
    'circle-color': ['match', ['get','worst'], 'critical',MAP_INK.red, 'major',MAP_INK.red, 'minor',MAP_INK.amber, 'maintenance',MAP_INK.blue, MAP_INK.ink3],
    'circle-opacity': 0.9, ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'service-status-label', type: 'symbol', source: 'service-status', minzoom: 2, layout: {
    'text-field': ['concat', ['get','city'], ' · ', ['to-string', ['get','count']]],
    'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Weather Events (NASA EONET) — deep violet
  map.addLayer({ id: 'weather-dots', type: 'circle', source: 'weather', paint: {
    'circle-radius': markerRadius(3.5, 5, 7),
    'circle-color': ['match', ['get','icon'], 'volcano',MAP_INK.red, 'alert',MAP_INK.amber, MAP_INK.violet],
    'circle-opacity': ['match', ['get','severity'], 'high',0.95, 'medium',0.85, 0.7],
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'weather-label', type: 'symbol', source: 'weather', minzoom: 4, layout: {
    'text-field': ['get','title'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Nuclear Infrastructure — teal / amber risk
  map.addLayer({ id: 'infra-dots', type: 'circle', source: 'infrastructure', paint: {
    'circle-radius': markerRadius(3, 4.5, 6.5),
    'circle-color': ['case', 
      ['in', 'SEISMIC RISK', ['get', 'status']], MAP_INK.amber,
      ['==', ['get','status'], 'Active Conflict Zone'], MAP_INK.red,
      ['in', 'Decommission', ['get', 'status']], MAP_INK.ink3,
      ['==', ['get','status'], 'Under Construction'], MAP_INK.sand,
      MAP_INK.teal
    ],
    'circle-opacity': 0.9,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'infra-label', type: 'symbol', source: 'infrastructure', minzoom: 6, layout: {
    'text-field': ['get','name'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: labelPaint() });

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

  // Ports and naval bases: neutral unless naval or energy
  map.addLayer({ id: 'maritime-dots', type: 'circle', source: 'maritime', paint: {
    'circle-radius': markerRadius(2, 3.5, 5),
    'circle-color': ['match', ['get','type'], 'naval',MAP_INK.violet, 'energy',MAP_INK.sand, MAP_INK.ink2],
    'circle-opacity': 0.85,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'maritime-label', type: 'symbol', source: 'maritime', minzoom: 5, layout: {
    'text-field': ['get','name'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: labelPaint(MAP_INK.ink3) });

  // Maritime chokepoints, coloured by risk
  map.addLayer({ id: 'choke-dots', type: 'circle', source: 'maritime-choke', paint: {
    'circle-radius': markerRadius(3.5, 5, 7),
    'circle-color': ['match', ['get','risk'], 'CRITICAL',MAP_INK.red, 'HIGH',MAP_INK.amber, 'ELEVATED',MAP_INK.sand, MAP_INK.ink2],
    'circle-opacity': 0.9,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'choke-label', type: 'symbol', source: 'maritime-choke', minzoom: 3, layout: {
    'text-field': ['get','name'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Live news streams
  map.addLayer({ id: 'news-dots', type: 'circle', source: 'live-news', paint: {
    'circle-radius': markerRadius(3, 4.5, 6),
    'circle-color': MAP_INK.rose, 'circle-opacity': 0.9,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'news-label', type: 'symbol', source: 'live-news', minzoom: 5, layout: {
    'text-field': ['get','name'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Live Alert pins — a report at the place it names, coloured by what it describes
  const alertColor: LayerColor = ['match', ['get','kind'], 'rocket', MAP_INK.red, 'event', MAP_INK.amber, MAP_INK.blue];
  map.addLayer({ id: 'alert-pin-dots', type: 'circle', source: 'alert-pins', paint: {
    'circle-radius': markerRadius(3.5, 5, 7),
    'circle-color': alertColor,
    // A region is placed less exactly than a town, so it is drawn as a ring.
    'circle-opacity': ['case', ['==', ['get','precision'], 'region'], 0.15, 0.95],
    'circle-stroke-width': 1,
    'circle-stroke-color': ['match', ['get','precision'], 'region', alertColor, MAP_INK.surface0] as LayerColor,
  }});
  // A report just in, and the pin a popup is open on, each get a ring.
  map.addLayer({ id: 'alert-pin-pulse', type: 'circle', source: 'alert-pins', filter: ['==', ['get','fresh'], true], paint: {
    'circle-radius': 9, 'circle-color': 'transparent',
    'circle-stroke-color': alertColor as never, 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.7,
  }});
  map.addLayer({ id: 'alert-pin-selected', type: 'circle', source: 'alert-pins', filter: ['==', ['get','id'], ''], paint: {
    'circle-radius': 11, 'circle-color': 'transparent',
    'circle-stroke-color': MAP_INK.ink1, 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.9,
  }});
  map.addLayer({ id: 'alert-pin-label', type: 'symbol', source: 'alert-pins', minzoom: 5, layout: {
    // "Riyadh ·3" when three reports name the same town.
    'text-field': ['case', ['>', ['get','stack'], 1],
      ['concat', ['get','place_name'], ' ·', ['to-string', ['get','stack']]],
      ['get','place_name']],
    'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // ══ IP SWEEP — Neighborhood device visualization ══
  map.addLayer({ id: 'sweep-connections', type: 'line', source: 'ip-sweep-connections', paint: {
    'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.3, 'line-dasharray': [2, 4],
  }});
  map.addLayer({ id: 'sweep-pulse-ring', type: 'circle', source: 'ip-sweep-pulse', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 8,40, 12,80, 16,160],
    'circle-color': 'transparent', 'circle-opacity': 0.6,
    'circle-stroke-width': 1, 'circle-stroke-color': MAP_INK.red, 'circle-stroke-opacity': 0.4,
  }});
  map.addLayer({ id: 'sweep-device-dots', type: 'circle', source: 'ip-sweep-devices', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 8,3, 12,5, 16,8],
    'circle-color': ['get', 'color'], 'circle-opacity': 0.95,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'sweep-device-labels', type: 'symbol', source: 'ip-sweep-devices', minzoom: 13, layout: {
    'text-field': ['concat', ['get', 'device_type'], '\n', ['get', 'ip']],
    'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // ══ SCAN TARGETS — Geolocated individual scans ══
  map.addLayer({ id: 'scan-targets-dots', type: 'circle', source: 'scan-targets', paint: {
    'circle-radius': markerRadius(5, 6, 8),
    'circle-color': MAP_INK.red, 'circle-opacity': 0.9,
    'circle-stroke-width': 1.5, 'circle-stroke-color': MAP_INK.ink1, 'circle-stroke-opacity': 0.8,
  }});
  map.addLayer({ id: 'scan-targets-label', type: 'symbol', source: 'scan-targets', layout: {
    'text-field': ['get', 'id'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: labelPaint(MAP_INK.ink1) });

  // Selected aircraft's route, under the aircraft so the icon sits on its line.
  map.addSource('selected-flight', { type: 'geojson', data: EMPTY_FC });
  map.addLayer({ id: 'sel-flight-flown', type: 'line', source: 'selected-flight', filter: ['==', ['get', 'kind'], 'flown'],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': MAP_INK.ink1, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.25, 6, 2, 10, 3], 'line-opacity': 0.8 } });
  map.addLayer({ id: 'sel-flight-ahead', type: 'line', source: 'selected-flight', filter: ['==', ['get', 'kind'], 'ahead'],
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': MAP_INK.ink1, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 6, 1.5, 10, 2], 'line-opacity': 0.45, 'line-dasharray': [2, 2] } });
  map.addLayer({ id: 'sel-flight-airport', type: 'circle', source: 'selected-flight', filter: ['==', ['get', 'kind'], 'airport'],
    paint: { 'circle-radius': 4, 'circle-color': MAP_INK.surface1, 'circle-stroke-width': 2, 'circle-stroke-color': MAP_INK.ink1 } });
  map.addLayer({ id: 'sel-flight-airport-label', type: 'symbol', source: 'selected-flight', filter: ['==', ['get', 'kind'], 'airport'],
    layout: { 'text-field': ['get', 'label'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': true },
    paint: labelPaint(MAP_INK.ink1) });

  // Flight layers (WebGL symbol — GPU rendered, handles 50K+ smooth)
  const flightLayers = [
    { id: 'fl-commercial', src: 'flights', icon: 'plane-cyan' },
    { id: 'fl-private', src: 'private-fl', icon: 'plane-green' },
    { id: 'fl-jets', src: 'jets', icon: 'plane-pink' },
    { id: 'fl-military', src: 'military', icon: 'plane-red' },
  ];
  flightLayers.forEach(l => {
    map.addLayer({ id: l.id, type: 'symbol', source: l.src, layout: {
      'icon-image': l.icon, 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.38, 5,0.6, 10,0.85, 14,1],
      'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
    }, paint: { 'icon-opacity': 0.9 }});
  });

  // Upcoming launches, one pin per pad: green once LL2 says Go
  map.addLayer({ id: 'launch-dots', type: 'circle', source: 'launches', paint: {
    'circle-radius': markerRadius(3.5, 5, 7),
    'circle-color': ['match', ['get','status'], 'Go',MAP_INK.green, 'Hold',MAP_INK.amber, MAP_INK.blue],
    'circle-opacity': 0.9,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'launch-label', type: 'symbol', source: 'launches', minzoom: 3, layout: {
    'text-field': ['get','when'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Balloons (moving entities)
  map.addLayer({ id: 'balloon-dots', type: 'circle', source: 'balloons', paint: {
    'circle-radius': markerRadius(2.5, 4, 6),
    'circle-color': ['get', 'color'],
    'circle-opacity': 0.85,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'balloon-label', type: 'symbol', source: 'balloons', minzoom: 5, layout: {
    'text-field': ['get','callsign'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Radiation — violet when within its own week's range (or unrated), amber/orange above it, grey once silent
  const RAD_COLOR: LayerColor = ['match', ['get','status'], 'SPIKE',MAP_INK.red, 'ELEVATED',MAP_INK.amber, 'OFFLINE',MAP_INK.ink3, MAP_INK.violet];
  map.addLayer({ id: 'rad-dots', type: 'circle', source: 'radiation', paint: {
    'circle-radius': markerRadius(2.5, 4, 6),
    'circle-color': RAD_COLOR,
    'circle-opacity': ['match', ['get','status'], 'UNRATED', 0.6, 0.9],
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'rad-label', type: 'symbol', source: 'radiation', minzoom: 6, layout: {
    'text-field': ['concat', ['to-string', ['get','reading']], ' nSv/h'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // War and air-raid alerts — full strength while the siren or oblast alert stands, faint once it has ended
  map.addLayer({ id: 'war-alert-glow', type: 'circle', source: 'war-alerts-targets', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1, ['match',['get','precision'],'oblast',14,8], 6, ['match',['get','precision'],'oblast',40,18]],
    'circle-color': ['get','color'],
    // The disc is the alerted area, not a glow: an oblast covers far more than a town.
    'circle-opacity': ['case', ['==',['get','active'],true], 0.14, 0.04], 'circle-blur': 0.6,
  }});
  map.addLayer({ id: 'war-alert-dots', type: 'circle', source: 'war-alerts-targets', paint: {
    'circle-radius': markerRadius(3, 4.5, 6.5),
    'circle-color': ['get','color'],
    'circle-opacity': ['case', ['==',['get','active'],true], 0.95, 0.4],
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'war-alert-label', type: 'symbol', source: 'war-alerts-targets', minzoom: 5, layout: {
    'text-field': ['get','place'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Agency-reported wildfires (CWFIS) over the FIRMS hotspots — sized by burned area, coloured by stage of control
  map.addLayer({ id: 'fire-incident-dots', type: 'circle', source: 'fire-incidents', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 2, ['interpolate',['linear'],['get','size'], 0,2.5, 10000,6, 100000,9], 8, ['interpolate',['linear'],['get','size'], 0,5, 10000,12, 100000,18]],
    'circle-color': ['get','color'], 'circle-opacity': 0.85,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'fire-incident-label', type: 'symbol', source: 'fire-incidents', minzoom: 7, layout: {
    'text-field': ['get','name'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // FAA airport delay programmes — one pin per airport at its worst programme
  map.addLayer({ id: 'airport-delay-dots', type: 'circle', source: 'airport-delays', paint: {
    'circle-radius': markerRadius(3.5, 5.5, 7.5),
    'circle-color': ['get','color'], 'circle-opacity': 0.9,
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'airport-delay-label', type: 'symbol', source: 'airport-delays', minzoom: 3, layout: {
    'text-field': ['get','code'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Bold'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // PortWatch chokepoint traffic — rings, so they sit apart from the static chokepoint markers
  map.addLayer({ id: 'chokepoint-flow-ring', type: 'circle', source: 'chokepoint-flow', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,7, 5,13, 9,20],
    'circle-color': 'rgba(0,0,0,0)',
    'circle-stroke-width': ['case', ['==',['get','status'],'disrupted'], 2, 1.25], 'circle-stroke-color': ['get','color'], 'circle-stroke-opacity': 0.9,
  }});
  map.addLayer({ id: 'chokepoint-flow-label', type: 'symbol', source: 'chokepoint-flow', minzoom: 3, layout: {
    'text-field': ['get','name'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.6], 'text-anchor': 'top', 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // Outbreak notices — a soft ring at the country centroid, never a pin: the issuers name countries, not places
  map.addLayer({ id: 'outbreak-rings', type: 'circle', source: 'outbreaks', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1, ['+', 8, ['*', 2, ['get','count']]], 5, ['+', 22, ['*', 4, ['get','count']]]],
    'circle-color': ['get','color'], 'circle-opacity': 0.08,
    'circle-stroke-width': 1, 'circle-stroke-color': ['get','color'], 'circle-stroke-opacity': 0.75,
  }});
  map.addLayer({ id: 'outbreak-label', type: 'symbol', source: 'outbreaks', minzoom: 2.5, layout: {
    'text-field': ['get','label'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-max-width': 14, 'text-allow-overlap': false,
  }, paint: labelPaint() });

  // ══ TAKIP SDK links: submarine cables (SEA), air and intel routes ══
  map.addLayer({ id: 'sdk-sea', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'SEA'],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#7E9CC4',
      'line-width': ['interpolate',['linear'],['zoom'], 1, 0.5, 5, 0.8, 10, 1.25],
      'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.2, 5, 0.28, 10, 0.4],
    }});

  map.addLayer({ id: 'sdk-air', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
    'line-color': MAP_INK.ink2,
    'line-width': ['interpolate',['linear'],['zoom'], 1, 0.4, 5, 0.7, 10, 1.1],
    'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.18, 5, 0.26, 10, 0.36],
  }});

  map.addLayer({ id: 'sdk-intel', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
    'line-color': MAP_INK.violet,
    'line-width': ['interpolate',['linear'],['zoom'], 1, 0.4, 5, 0.7, 10, 1.1],
    'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.2, 5, 0.3, 10, 0.4],
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
  map.addLayer({ id: 'wx-temp-label', type: 'symbol', source: 'wx-points', filter: ['!=', ['get','shownTemp'], null], layout: {
    'text-field': ['concat', ['to-string', ['get','shownTemp']], '°'],
    'text-size': ['interpolate',['linear'],['zoom'], 1,11, 5,12],
    'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.3], 'text-allow-overlap': false,
  }, paint: labelPaint(MAP_INK.ink1) });

  // Maritime Ships — coloured by vessel class; arrows take over once headings are legible.
  if (!map.hasImage('ship-arrow')) {
    const s = 24, c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(s / 2, 2); ctx.lineTo(s - 5, s - 3); ctx.lineTo(s / 2, s - 8); ctx.lineTo(5, s - 3); ctx.closePath(); ctx.fill();
    map.addImage('ship-arrow', { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) }, { sdf: true });
  }
  // A ship with no course gets a dot, not an arrow pointing north for no reason.
  if (!map.hasImage('ship-still')) {
    const s = 24, c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s / 2, s / 2, 5, 0, Math.PI * 2); ctx.fill();
    map.addImage('ship-still', { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) }, { sdf: true });
  }
  const shipColorExpr = ['match', ['get','type'], ...shipColorArms(), SHIP_FALLBACK_COLOR] as unknown as CirclePaint['circle-color'];
  map.addLayer({ id: 'ship-dots', type: 'circle', source: 'maritime-ships', maxzoom: 6, paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.1, 4,1.9, 6,2.8],
    'circle-color': shipColorExpr,
    'circle-opacity': ['interpolate',['linear'],['zoom'], 1,0.55, 6,0.8],
  }});
  map.addLayer({ id: 'ship-arrows', type: 'symbol', source: 'maritime-ships', minzoom: 6, layout: {
    'icon-image': ['case', HAS_COURSE, 'ship-arrow', 'ship-still'],
    'icon-size': ['interpolate',['linear'],['zoom'], 6,0.45, 10,0.65, 14,0.9],
    'icon-rotate': ['case', HAS_COURSE, ['to-number', ['get','heading']], 0], 'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
  }, paint: { 'icon-color': shipColorExpr }});
  map.addLayer({ id: 'ship-label', type: 'symbol', source: 'maritime-ships', minzoom: 10, layout: {
    'text-field': ['get','name'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false,
  }, paint: labelPaint(MAP_INK.ink3) });
}
