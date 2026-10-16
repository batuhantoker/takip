import type * as maplibregl from 'maplibre-gl';
import { addAviationWeatherLayers } from '@/lib/feeds/aviation-weather/layers';
import { LABEL_SIZE, MAP_INK, MARKER_STROKE, labelPaint, markerRadius } from '@/lib/map/style/tokens';
import type { LayerColor } from './shared';

export function addAlertLayers(map: maplibregl.Map) {
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

  addAviationWeatherLayers(map);

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
}
