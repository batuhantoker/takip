import type * as maplibregl from 'maplibre-gl';
import { addAlprLayers } from '@/lib/feeds/cameras/alpr-layers';
import { addCctvLayers } from '@/lib/feeds/cameras/map-layers';
import { LABEL_SIZE, MAP_INK, MARKER_STROKE, labelPaint, markerRadius } from '@/lib/map/style/tokens';
import { addTrafficLayers } from '@/lib/feeds/traffic/map-layers';
import { FIRE_PERIMETER_FILL, FIRE_PERIMETER_LINE, FIRE_PERIMETER_SOURCE } from '@/lib/feeds/hazards/fire-perimeters';
import type { LayerColor } from './shared';

export function addGroundLayers(map: maplibregl.Map, isGhost: boolean, cameraColor: string) {
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

  // Fires: agency-mapped US perimeters (NIFC WFIGS) under the satellite hotspots
  map.addLayer({ id: FIRE_PERIMETER_FILL, type: 'fill', source: FIRE_PERIMETER_SOURCE, paint: {
    'fill-color': ['match', ['get','kind'], 'prescribed', MAP_INK.amber, MAP_INK.red], 'fill-opacity': 0.16,
  }});
  map.addLayer({ id: FIRE_PERIMETER_LINE, type: 'line', source: FIRE_PERIMETER_SOURCE, paint: {
    'line-color': ['match', ['get','kind'], 'prescribed', MAP_INK.amber, MAP_INK.red],
    'line-width': ['interpolate',['linear'],['zoom'], 3,0.6, 8,1.2, 12,2], 'line-opacity': 0.9,
  }});
  map.addLayer({ id: 'fires-heat', type: 'circle', source: 'fires', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.5, 6,2.5, 10,4, 14,6],
    'circle-color': '#DB7B48', 'circle-opacity': 0.6,
  }});

  addTrafficLayers(map);
  // Under the CCTV dots: a live camera wins a shared spot.
  addAlprLayers(map);
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
}
