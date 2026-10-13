import type { ExpressionSpecification } from 'maplibre-gl';

/** Slower than this a craft points nowhere in particular: moored, anchored or parked. */
export const STILL_KNOTS = 0.5;

const toNum = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * The heading worth showing, or null. AIS sends 360 (course) and 511 (heading) for
 * "not available"; an unknown speed keeps the heading, a stopped craft loses it.
 */
export function course(heading: unknown, speed: unknown): number | null {
  const h = toNum(heading), s = toNum(speed);
  if (h == null || h < 0 || h >= 360) return null;
  if (s != null && s < STILL_KNOTS) return null;
  return h;
}

/** `course` as a map expression on a feature's `heading` and `speed`. */
export const HAS_COURSE: ExpressionSpecification = ['all',
  ['>=', ['to-number', ['coalesce', ['get', 'heading'], -1]], 0],
  ['<', ['to-number', ['coalesce', ['get', 'heading'], 360]], 360],
  ['>=', ['to-number', ['coalesce', ['get', 'speed'], STILL_KNOTS]], STILL_KNOTS],
];
