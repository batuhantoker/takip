import type * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification } from 'maplibre-gl';
import { MAP_INK } from '@/lib/map/style/tokens';

/**
 * Licence-plate readers (ALPR) mapped on OpenStreetMap, from DeFlock's hourly
 * vector tiles (one `cameras` layer, z0–14, CORS open). Tiles below z9 are a
 * density extract with no attributes, so details start at DETAIL_ZOOM.
 */
export const ALPR_COLOR = MAP_INK.violet;
export const ALPR_DETAIL_ZOOM = 9;
export const ALPR_FOV_ZOOM = 13;
export const ALPR_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors · <a href="https://deflock.me" target="_blank" rel="noopener">DeFlock</a>';

// Tiles outside an extract 404 (MapLibre ignores those). Canada's TileJSON stops at 51.2° N today; the box allows for growth.
export const ALPR_EXTRACTS = [
  { id: 'us', bounds: [-159.61, 17.68, -64.59, 61.62] },
  { id: 'ca', bounds: [-141.01, 41.67, -52.62, 63] },
] as const;

/** A node can map several bearings; 17% do. Beyond four is noise like "[0,0,0,0,0,0,0,113]". */
const MAX_BEARINGS = 4;
const FOV_IMAGE = 'alpr-fov';

/** The markers: hover and click land here, never on the cones, whose icon box is mostly empty. */
export const ALPR_PICK_LAYERS = ALPR_EXTRACTS.map(e => `alpr-${e.id}-dots`);
export const ALPR_LAYERS = ALPR_EXTRACTS.flatMap(e => [
  ...Array.from({ length: MAX_BEARINGS }, (_, n) => `alpr-${e.id}-fov-${n}`),
  `alpr-${e.id}-dots`,
]);

const BEARINGS: ExpressionSpecification = ['case',
  ['has', 'directions'], ['to-string', ['get', 'directions']],
  ['has', 'direction'], ['concat', '[', ['to-string', ['get', 'direction']], ']'],
  ''];
const comma = (r: ExpressionSpecification): ExpressionSpecification => ['index-of', ',', r];
const after = (r: ExpressionSpecification): ExpressionSpecification =>
  ['case', ['>=', comma(r), 0], ['slice', r, ['+', comma(r), 1]], ''];
// to-number reads '' as 0 (north), so an empty rest has to be caught first.
const head = (r: ExpressionSpecification): ExpressionSpecification =>
  ['case', ['==', r, ''], -1, ['to-number', ['slice', r, 0, ['case', ['>=', comma(r), 0], comma(r), ['index-of', ']', r]]], -1]];

/** The nth bearing from DeFlock's `directions` string ("[200,339]"), or -1. */
export function alprBearing(n: number): ExpressionSpecification {
  let body = head(['var', `r${n}`]);
  for (let k = n; k >= 1; k--) body = ['let', `r${k}`, after(['var', `r${k - 1}`]), body];
  return ['let', 'r0', ['slice', BEARINGS, 1], body];
}

const bearingFilter = (n: number): ExpressionSpecification =>
  ['all', ['>=', alprBearing(n), 0], ...Array.from({ length: n }, (_, m): ExpressionSpecification => ['!=', alprBearing(n), alprBearing(m)])];

/** Far out a faint haze of where readers cluster; close in, one marker each. */
const DOT_PAINT = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 8, 1.5, ALPR_DETAIL_ZOOM, 2.2, 14, 4.5, 17, 6],
  'circle-color': ALPR_COLOR,
  'circle-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.28, 8, 0.45, ALPR_DETAIL_ZOOM, 0.75, 13, 0.9],
  'circle-stroke-width': ['step', ['zoom'], 0, 12, 1],
  'circle-stroke-color': MAP_INK.surface0,
  'circle-stroke-opacity': 0.8,
} satisfies NonNullable<Extract<maplibregl.LayerSpecification, { type: 'circle' }>['paint']>;

/*
 * The cone image is 64 px from apex to rim at size 1. Past z15 it doubles per zoom,
 * so the reach stays near 35 m on the ground (~0.9 m/px at z16, 40° N); nearer z13
 * it is held larger to stay visible.
 */
const FOV_SIZE: ExpressionSpecification = ['interpolate', ['exponential', 2], ['zoom'], ALPR_FOV_ZOOM, 0.16, 15, 0.3, 18, 2.4];
const FOV_HALF_ANGLE = 20;
const FOV_PX = 256;

/** A soft 40° beam pointing north from the image centre, so icon-rotate turns it about the camera. */
function addFovImage(map: maplibregl.Map) {
  if (map.hasImage(FOV_IMAGE)) return;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FOV_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const c = FOV_PX / 2;
  const spread = (FOV_HALF_ANGLE * Math.PI) / 180;
  const fade = ctx.createRadialGradient(c, c, 0, c, c, c);
  fade.addColorStop(0, `${ALPR_COLOR}B3`);
  fade.addColorStop(0.65, `${ALPR_COLOR}4D`);
  fade.addColorStop(1, `${ALPR_COLOR}00`);
  ctx.fillStyle = fade;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, c, -Math.PI / 2 - spread, -Math.PI / 2 + spread);
  ctx.closePath();
  ctx.fill();
  map.addImage(FOV_IMAGE, ctx.getImageData(0, 0, FOV_PX, FOV_PX), { pixelRatio: 2 });
}

/** Sources and hidden layers; MapLibre fetches no tiles until a layer is shown. */
export function addAlprLayers(map: maplibregl.Map) {
  addFovImage(map);
  for (const { id, bounds } of ALPR_EXTRACTS) {
    const source = `alpr-${id}`;
    map.addSource(source, {
      type: 'vector',
      tiles: [`https://tiles.dontgetflocked.com/cameras-${id}-hourly/{z}/{x}/{y}.mvt`],
      minzoom: 0, maxzoom: 14, bounds: [...bounds],
      attribution: ALPR_ATTRIBUTION,
    });
    for (let n = 0; n < MAX_BEARINGS; n++) {
      map.addLayer({
        id: `alpr-${id}-fov-${n}`, type: 'symbol', source, 'source-layer': 'cameras', minzoom: ALPR_FOV_ZOOM,
        filter: bearingFilter(n),
        layout: {
          visibility: 'none',
          'icon-image': FOV_IMAGE,
          'icon-size': FOV_SIZE,
          'icon-rotate': alprBearing(n),
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], ALPR_FOV_ZOOM, 0, ALPR_FOV_ZOOM + 0.6, 1] },
      });
    }
    map.addLayer({
      id: `alpr-${id}-dots`, type: 'circle', source, 'source-layer': 'cameras', minzoom: 3,
      layout: { visibility: 'none' }, paint: DOT_PAINT,
    });
  }
}
