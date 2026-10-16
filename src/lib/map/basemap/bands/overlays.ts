import type * as maplibregl from 'maplibre-gl';
import { HAS_COURSE } from '@/lib/map/course';
import { LABEL_SIZE, MAP_INK, labelPaint } from '@/lib/map/style/tokens';
import { SHIP_FALLBACK_COLOR, shipColorArms } from '@/lib/feeds/maritime/ship-filter';
import { addShipIcons } from './icons';
import type { CirclePaint } from './shared';

export function addOverlayLayers(map: maplibregl.Map) {
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
  map.addLayer({ id: 'wx-temp-label', type: 'symbol', source: 'wx-temp-points', layout: {
    'text-field': ['concat', ['to-string', ['get','shownTemp']], '°'],
    'text-size': ['interpolate',['linear'],['zoom'], 1,11, 5,12],
    // Under the place name it belongs to, and never pushing a name off the map.
    'text-font': ['Noto Sans Bold'], 'text-anchor': 'top', 'text-offset': [0, 1.1],
    'text-allow-overlap': true, 'text-ignore-placement': true,
  }, paint: labelPaint(MAP_INK.ink1) });

  // Maritime Ships — coloured by vessel class; arrows take over once headings are legible.
  addShipIcons(map);
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
