import type * as maplibregl from 'maplibre-gl';
import { LABEL_SIZE, MAP_INK, MARKER_STROKE, labelPaint, markerRadius } from '@/lib/map/style/tokens';
import { createSatelliteLayer } from '@/lib/feeds/satellites/layer';
import { addNhcLayers } from '@/lib/feeds/hazards/nhc-forecast';
import { addEmergencyLayers } from '@/lib/feeds/aviation/emergency';
import { EMPTY_FC, type LayerColor } from './shared';

export function addSiteLayers(map: maplibregl.Map, satLayerRef: { current: ReturnType<typeof createSatelliteLayer> | null }) {
  // NHC forecast cones and tracks, under the storm pins
  addNhcLayers(map);

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
  // Off-air channels keep their pin, faded, as cameras do.
  map.addLayer({ id: 'news-dots', type: 'circle', source: 'live-news', paint: {
    'circle-radius': markerRadius(3, 4.5, 6),
    'circle-color': MAP_INK.rose, 'circle-opacity': ['case', ['==', ['get', 'offline'], true], 0.35, 0.9],
    ...MARKER_STROKE,
    'circle-stroke-opacity': ['case', ['==', ['get', 'offline'], true], 0.4, 0.8],
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
  // ── FLIGHT ROUTE VISUALIZATION SOURCES & LAYERS ──

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
  addEmergencyLayers(map);

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
}
