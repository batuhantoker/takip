import type * as maplibregl from 'maplibre-gl';
import { pop } from '@/lib/map/popups/kit';
import { LABEL_SIZE, MAP_INK, MARKER_STROKE, labelPaint } from '@/lib/map/style/tokens';

/*
 * The NHC forecast for active storms (/api/weather/nhc-forecast): cone of uncertainty, forecast track
 * and forecast points, under the Severe Weather layer and beneath its storm pins.
 */

export const NHC_SOURCE = 'nhc-forecast';
export const NHC_CONE = 'nhc-cone-fill';
export const NHC_POINTS = 'nhc-points';
export const NHC_LAYERS = [NHC_CONE, 'nhc-cone-line', 'nhc-track', NHC_POINTS, 'nhc-point-label'];

type Props = Record<string, unknown>;
const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Colour of a forecast point by development stage: hurricanes red, storms amber, depressions blue. */
const stageColor: maplibregl.ExpressionSpecification = ['match', ['get', 'stage'], ['H', 'M'], MAP_INK.red, 'S', MAP_INK.amber, 'D', MAP_INK.blue, MAP_INK.ink2];

export function addNhcLayers(map: maplibregl.Map) {
  map.addLayer({ id: NHC_CONE, type: 'fill', source: NHC_SOURCE, filter: ['==', ['get', 'kind'], 'cone'], paint: { 'fill-color': MAP_INK.ink1, 'fill-opacity': 0.08 } });
  map.addLayer({ id: 'nhc-cone-line', type: 'line', source: NHC_SOURCE, filter: ['==', ['get', 'kind'], 'cone'], paint: {
    'line-color': MAP_INK.ink2, 'line-width': 1, 'line-opacity': 0.8, 'line-dasharray': [3, 2],
  }});
  map.addLayer({ id: 'nhc-track', type: 'line', source: NHC_SOURCE, filter: ['==', ['get', 'kind'], 'track'], paint: {
    'line-color': MAP_INK.ink1, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1, 7, 2], 'line-opacity': 0.85,
  }});
  map.addLayer({ id: NHC_POINTS, type: 'circle', source: NHC_SOURCE, filter: ['==', ['get', 'kind'], 'point'], paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2.5, 7, 5], 'circle-color': stageColor, ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'nhc-point-label', type: 'symbol', source: NHC_SOURCE, minzoom: 4, filter: ['all', ['==', ['get', 'kind'], 'point'], ['>', ['get', 'hours'], 0]], layout: {
    'text-field': ['concat', '+', ['to-string', ['get', 'hours']], ' h'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0.9, 0], 'text-anchor': 'left', 'text-allow-overlap': false,
  }, paint: labelPaint(MAP_INK.ink2) });
}

const graphics = (bin: unknown) => `https://www.nhc.noaa.gov/graphics_${String(bin).toLowerCase()}.shtml`;

export function nhcPointPopupHtml(p: Props): string {
  const hours = num(p.hours), wind = num(p.wind), gust = num(p.gust), pressure = num(p.pressure);
  return pop({
    kicker: hours ? `Forecast, ${hours} h ahead` : 'Forecast start',
    tone: p.stage === 'H' || p.stage === 'M' ? 'red' : p.stage === 'S' ? 'amber' : 'neutral',
    title: `${p.stageLabel ?? 'Forecast'} ${p.storm ?? ''}`.trim(),
    subtitle: `NHC advisory ${p.advisory}`,
    rows: [
      { label: 'Valid', value: p.when ? String(p.when) : null, mono: true },
      { label: 'Wind', value: wind == null ? null : `${wind} kt`, mono: true },
      { label: 'Gusts', value: gust == null ? null : `${gust} kt`, mono: true },
      { label: 'Pressure', value: pressure == null ? null : `${pressure} mb`, mono: true },
    ],
    links: [{ href: graphics(p.bin), label: 'NHC forecast' }],
  });
}

export function nhcConePopupHtml(p: Props): string {
  return pop({
    kicker: 'Forecast cone',
    title: String(p.storm ?? 'Storm'),
    subtitle: `NHC advisory ${p.advisory}`,
    note: 'Where the centre will probably go over five days, from the size of past forecast errors. Wind, rain and surge reach well outside it.',
    links: [{ href: graphics(p.bin), label: 'NHC forecast' }],
  });
}

export function nhcTip(p: Props, layer: string) {
  if (layer === NHC_CONE) return { key: `nhc-cone:${p.bin}`, name: `${p.storm} forecast cone`, meta: `NHC advisory ${p.advisory}` };
  const hours = num(p.hours), wind = num(p.wind);
  return {
    key: `nhc:${p.bin}:${hours}`,
    name: `${p.storm}, ${hours ? `+${hours} h` : 'now'}`,
    meta: [String(p.stageLabel ?? ''), wind == null ? null : `${wind} kt`].filter(Boolean).join(' · '),
  };
}
