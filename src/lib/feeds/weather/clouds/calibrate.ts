import { HALF, PAD, PADDED, REF_HALF_HEIGHT, REF_HEIGHT, REF_WIDTH, TILE, tileBbox } from './tiles';

/* ── One scale for every tile ──────────────────────────────────────────────
   NOAA stretches the contrast of every image it serves across that image
   alone. The same cloud comes out a different grey in each tile — up to a
   quarter of the range apart — so thresholds drift and every seam shows. Its
   firewall turns away a request that brings its own style, and its WCS
   publishes nothing, so the raw values are out of reach.

   The stretch is one monotonic curve per image, though, and a curve like that
   can be undone by matching histograms. Each frame, one image of the whole
   world is fetched: a single stretch, the same everywhere. Each tile's greys
   are then mapped, quantile for quantile, onto the greys of the same patch of
   that image. */

/** Grey levels of a tile's unpadded pixels, skipping those outside the satellites' view. */
export function tileHistogram(rgba: Uint8ClampedArray): Uint32Array {
  const hist = new Uint32Array(256);
  for (let j = PAD; j < PAD + TILE; j++) {
    for (let i = PAD; i < PAD + TILE; i++) {
      const k = (j * PADDED + i) * 4;
      if (rgba[k + 3] > 0) hist[rgba[k]]++;
    }
  }
  return hist;
}

/** Where a tile falls on the reference image, in its pixels, clipped to it. */
export function referenceFootprint(z: number, x: number, y: number) {
  const [minx, miny, maxx, maxy] = tileBbox(z, x, y);
  const toX = (m: number) => ((m + HALF) / (2 * HALF)) * REF_WIDTH;
  const toY = (m: number) => ((REF_HALF_HEIGHT - m) / (2 * REF_HALF_HEIGHT)) * REF_HEIGHT;
  return {
    x0: Math.max(0, Math.floor(toX(minx))), x1: Math.min(REF_WIDTH, Math.ceil(toX(maxx))),
    y0: Math.max(0, Math.floor(toY(maxy))), y1: Math.min(REF_HEIGHT, Math.ceil(toY(miny))),
  };
}

/**
 * Grey levels of the reference under a footprint. The reference is a JPEG, with
 * no transparency, so the black outside the satellites' view is skipped by value.
 */
export function referenceHistogram(grey: Uint8Array, rect: { x0: number; x1: number; y0: number; y1: number }): Uint32Array {
  const hist = new Uint32Array(256);
  for (let j = rect.y0; j < rect.y1; j++) {
    for (let i = rect.x0; i < rect.x1; i++) {
      const v = grey[j * REF_WIDTH + i];
      if (v > 3) hist[v]++;
    }
  }
  return hist;
}

/* ── Clear sky ─────────────────────────────────────────────────────────────
   Clear ground reads colder toward the poles — about 62 in the tropics, 110
   at 60°, 130 at 70°, measured on the reference — and cloud is whatever is
   colder than that. It differs by region too: a Siberian night is colder than
   the sea at the same latitude, and toward the edge of their view the
   satellites see whole sectors as falsely cold. So each frame the world
   reference is cut into cells, a band of latitude by a sector of longitude,
   and each gives up a low percentile: the grey only a tenth of it is warmer
   than, which is ground showing between the clouds. Every tile reads the same
   grid, interpolated smoothly, so it cannot open a seam between two of them. */

/** Clear-sky infrared grey in the tropics, used when no reference was to hand. */
export const TROPICAL_CLEAR = 62;
/** Rows of the reference per latitude band. */
const BAND_ROWS = 24;
/** Columns of the reference per longitude sector: 22.5°. */
const SECTOR_COLS = 128;
/** The share of a cell taken to be clear ground. */
const CLEAR_PERCENTILE = 0.1;
/**
 * How far a cell's clear sky may stray from its latitude's: enough for a cold
 * night inland or a hot desert, not so far that a cell under one great storm
 * counts the storm as clear sky.
 */
const SECTOR_SPREAD = 30;

export interface ClearSky { bands: number; sectors: number; level: Float32Array }

/** The grey that a tenth of the counted pixels sit at or below, or NaN for too few. */
function percentile(hist: Uint32Array, n: number): number {
  if (n < MIN_SAMPLES) return NaN;
  let below = 0;
  for (let v = 0; v < 256; v++) { below += hist[v]; if (below >= n * CLEAR_PERCENTILE) return v; }
  return 255;
}

/** The frame's clear-sky grid, from its infrared reference. */
export function clearSky(grey: Uint8Array): ClearSky {
  const bands = Math.ceil(REF_HEIGHT / BAND_ROWS), sectors = REF_WIDTH / SECTOR_COLS;
  const band = new Float32Array(bands), level = new Float32Array(bands * sectors);
  const all = new Uint32Array(256), cell = new Uint32Array(256 * sectors), counts = new Uint32Array(sectors);
  for (let b = 0; b < bands; b++) {
    all.fill(0); cell.fill(0); counts.fill(0);
    let n = 0;
    for (let j = b * BAND_ROWS; j < Math.min(REF_HEIGHT, (b + 1) * BAND_ROWS); j++) {
      for (let i = 0; i < REF_WIDTH; i += 2) {
        const v = grey[j * REF_WIDTH + i];
        if (v <= 3) continue; // outside the satellites' view
        const sector = (i / SECTOR_COLS) | 0;
        all[v]++; n++;
        cell[sector * 256 + v]++; counts[sector]++;
      }
    }
    band[b] = percentile(all, n);
    for (let c = 0; c < sectors; c++) level[b * sectors + c] = percentile(cell.subarray(c * 256, c * 256 + 256), counts[c]);
  }
  // Bands outside the satellites' view borrow the nearest one that has data.
  for (let b = 0; b < bands; b++) {
    for (let d = 1; d < bands && Number.isNaN(band[b]); d++) {
      const near = [band[b - d], band[b + d]].find(v => v !== undefined && !Number.isNaN(v));
      if (near !== undefined) band[b] = near;
    }
    if (Number.isNaN(band[b])) band[b] = TROPICAL_CLEAR;
  }
  for (let b = 0; b < bands; b++) {
    for (let c = 0; c < sectors; c++) {
      const k = b * sectors + c;
      level[k] = Number.isNaN(level[k]) ? band[b] : Math.min(band[b] + SECTOR_SPREAD, Math.max(band[b] - SECTOR_SPREAD, level[k]));
    }
  }
  return { bands, sectors, level };
}

/** Clear-sky grey at a point of the reference, in its pixels: bilinear between cell centres, wrapping in longitude. */
export function clearSkyAt({ bands, sectors, level }: ClearSky, rx: number, ry: number): number {
  const t = Math.min(bands - 1, Math.max(0, ry / BAND_ROWS - 0.5));
  const b0 = Math.floor(t), b1 = Math.min(bands - 1, b0 + 1), fb = t - b0;
  const u = rx / SECTOR_COLS - 0.5, c = Math.floor(u), fc = u - c;
  const c0 = ((c % sectors) + sectors) % sectors, c1 = (c0 + 1) % sectors;
  const north = level[b0 * sectors + c0] * (1 - fc) + level[b0 * sectors + c1] * fc;
  const south = level[b1 * sectors + c0] * (1 - fc) + level[b1 * sectors + c1] * fc;
  return north * (1 - fb) + south * fb;
}

/** Clear-sky grey for every pixel of a padded tile. */
export function tileClearSky(z: number, x: number, y: number, sky: ClearSky): Float32Array {
  const size = (2 * HALF) / 2 ** z;
  const out = new Float32Array(PADDED * PADDED);
  for (let j = 0; j < PADDED; j++) {
    const my = HALF - y * size - ((j - PAD + 0.5) * size) / TILE;
    const ry = ((REF_HALF_HEIGHT - my) / (2 * REF_HALF_HEIGHT)) * REF_HEIGHT;
    for (let i = 0; i < PADDED; i++) {
      const mx = -HALF + x * size + ((i - PAD + 0.5) * size) / TILE;
      out[j * PADDED + i] = clearSkyAt(sky, ((mx + HALF) / (2 * HALF)) * REF_WIDTH, ry);
    }
  }
  return out;
}

/** Fewer samples than this and a histogram says little; the tile is drawn as served. */
const MIN_SAMPLES = 64;

/**
 * A table from a tile's grey levels to the reference's: each level goes to the
 * reference grey at the same quantile. Null when either side has too little to go on.
 */
export function matchLut(tile: Uint32Array, ref: Uint32Array): Uint8Array | null {
  let tn = 0, rn = 0;
  for (let v = 0; v < 256; v++) { tn += tile[v]; rn += ref[v]; }
  if (tn < MIN_SAMPLES || rn < MIN_SAMPLES) return null;

  const lut = new Uint8Array(256);
  let below = 0;  // tile pixels darker than the current level
  let r = 0;      // reference level the quantile has reached
  let rBelow = 0; // reference pixels darker than r
  for (let v = 0; v < 256; v++) {
    const q = (below + tile[v] / 2) / tn; // mid-rank, so a level maps to its centre
    below += tile[v];
    while (r < 255 && (rBelow + ref[r]) / rn < q) { rBelow += ref[r]; r++; }
    const within = ref[r] ? (q * rn - rBelow) / ref[r] : 0.5;
    lut[v] = Math.max(0, Math.min(255, Math.round(r - 0.5 + Math.min(1, Math.max(0, within)))));
  }
  return lut;
}

/** Remap a tile's greys in place. */
export function applyLut(rgba: Uint8ClampedArray, lut: Uint8Array): void {
  for (let k = 0; k < rgba.length; k += 4) {
    rgba[k] = rgba[k + 1] = rgba[k + 2] = lut[rgba[k]];
  }
}
