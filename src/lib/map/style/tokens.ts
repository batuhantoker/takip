import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * The design tokens (docs/design/README.md) as plain hex for MapLibre paint,
 * which cannot read CSS custom properties. Keep in step with globals.css.
 */
export const MAP_INK = {
  ink1: '#ECEEF0',
  ink2: '#A4AAB2',
  ink3: '#6D737B',
  surface0: '#0A0C0F',
  surface1: '#111317',
  surface3: '#1E2228',
  red: '#E5534B',
  amber: '#E9A23B',
  green: '#46B97F',
  blue: '#5B9CF5',
  violet: '#9B8AFB',
  /** Categorical tones, a step quieter than the status colours. */
  teal: '#5FB3C4',
  rose: '#D99AB4',
  sand: '#D8C26A',
  slate: '#7F8B96',
} as const;

/**
 * Series colours for things compared side by side (countries on History's chart and their map outlines),
 * in the order they're handed out. Checked with the dataviz validator on surface-1: the first four stay
 * apart for colour-blind readers even when every line crosses; five and six rely on their name labels.
 */
export const SERIES_INK = ['#C98500', '#D55181', '#9085E9', '#008300', '#3987E5', '#D95926'] as const;

/** Marker radius by zoom: small and calm far out, readable close in. */
export const markerRadius = (far = 2.5, mid = 4, near = 6): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], 2, far, 8, mid, 14, near];

/** Stroke that lifts a marker off the basemap without a glow. */
export const MARKER_STROKE = {
  'circle-stroke-width': 1,
  'circle-stroke-color': MAP_INK.surface0,
  'circle-stroke-opacity': 0.8,
} as const;

/** Label paint every data layer shares: Noto Sans on a dark halo. */
export const labelPaint = (color: string = MAP_INK.ink2) => ({
  'text-color': color,
  'text-halo-color': MAP_INK.surface0,
  'text-halo-width': 1.5,
  'text-halo-blur': 0.5,
});

export const LABEL_SIZE = 11;
