/** Elevation is metres above the ellipsoid; the catalogue is in kilometres. */
const KM_TO_M = 1000;

/*
 * The zoom past which satellites are neither drawn nor clickable.
 *
 * A satellite is drawn at a display altitude of hundreds of kilometres, which
 * is a sensible place for it while the view covers a country or more. Zoomed
 * into a city it is nowhere near the street it appears over, and its pick pass
 * still covers those pixels — so a click meant for a camera was being taken by
 * a satellite that is not really there. Above this zoom the operator is
 * looking at the ground, so the layer stands aside.
 */
export const SAT_MAX_ZOOM = 7;

/**
 * Altitude is compressed into a band the camera can actually show.
 *
 * Two hard limits bound this, both found by rendering and reading back the
 * framebuffer rather than by reasoning:
 *
 *   Floor. A satellite drawn at or near the surface is rejected by the depth
 *   test against the globe — it z-fights the very sphere it orbits. Nothing
 *   below roughly a tenth of an Earth radius reliably survives.
 *
 *   Ceiling. Drawn anywhere near true scale, GEO leaves the view frustum at
 *   any zoom that also shows the ground, and simply vanishes.
 *
 * So real altitude is mapped onto [FLOOR_KM, CEILING_KM]. The curve is sqrt,
 * which spreads the LEO shell — where most of the catalogue lives, 161 km to
 * about 2,000 km — instead of compressing it into a single line, while still
 * placing MEO and GEO distinguishably above it.
 *
 * This is a display transform, not a measurement. The popup shows the real
 * altitude in kilometres.
 */
const FLOOR_KM = 620;      // clears the globe depth test
const CEILING_KM = 2500;   // stays inside the frustum at world zoom
const MIN_ALT_KM = 150;    // lowest catalogue altitude that still orbits
const MAX_ALT_KM = 36000;  // the GEO belt

export function displayElevation(altKm: number, exaggeration = 1): number {
  if (!Number.isFinite(altKm) || altKm <= 0) return 0;
  const clamped = Math.min(Math.max(altKm, MIN_ALT_KM), MAX_ALT_KM);
  const t = (Math.sqrt(clamped) - Math.sqrt(MIN_ALT_KM)) /
            (Math.sqrt(MAX_ALT_KM) - Math.sqrt(MIN_ALT_KM));
  return (FLOOR_KM + (CEILING_KM - FLOOR_KM) * t) * exaggeration * KM_TO_M;
}

export interface SatPoint {
  lng: number;
  lat: number;
  altKm: number;
  /** Packed 0xRRGGBB. */
  color: number;
  /** Point size multiplier — the ISS and other stations read larger. */
  size: number;
}

/** Parses "#RRGGBB" (or a bare RRGGBB) into a packed integer. */
export function parseColor(hex: string | undefined, fallback = 0x00e5ff): number {
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? parseInt(m[1], 16) : fallback;
}
