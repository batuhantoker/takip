import { LIGHT } from './altitude';
import { TROPICAL_CLEAR } from './calibrate';
import { DAWN, DAY, sunTerms, tileGrid } from './sunlight';
import { PADDED } from './tiles';

/* ── Drawing the cloud ────────────────────────────────────────────────────── */

/**
 * Where cloud starts and where it is solid, as coldness above the clear-sky
 * grey for that latitude: 0 at clear ground, 1 at the coldest grey there is.
 * In the tropics, where clear sky reads about 62, these land on 105 and 200.
 */
const COLD_CLEAR = 0.22;
const COLD_SOLID = 0.71;
/** Latitudes, in radians, over which cloud fades out toward the edge of the satellites' view. */
const RIM_START = (66 * Math.PI) / 180;
const RIM_END = (74 * Math.PI) / 180;
/**
 * Height keeps rising past solid, up to here. Opacity tops out well below the
 * coldest storm tops, and a height that topped out with it left every storm a
 * flat white disc with nothing for the light to catch.
 */
const IR_TOP = 250;
/** Visible grey where cloud starts and where it is solid. */
const VIS_CLEAR = 110;
const VIS_SOLID = 180;
/**
 * Infrared grey below which ground is too hot to be cloud. Deserts are as
 * bright as cloud in visible light; this keeps the Sahara off the map while
 * leaving low marine cloud, which is cool but not cold.
 */
const IR_HOT = 55;
/**
 * Sun-angle correction: under a sun higher than HIGH_SUN visible light is taken
 * as it comes; lower down it is brightened, up to 1 / LOW_SUN at the horizon.
 */
const HIGH_SUN = 0.5;
const LOW_SUN = 0.4;
/** How strongly the visible band's fine detail marks the cloud, and over what radius "fine" is judged. */
const TEXTURE = 2.2;
const TEXTURE_RADIUS = 4;

/**
 * How strongly cloud-top height shapes the light at zoom 4. Closer in, each
 * pixel spans less ground, so the same tower is a gentler slope per pixel; the
 * relief grows with zoom to keep it standing up.
 */
const RELIEF = 10;
const RELIEF_PER_ZOOM = 1.5;
/** How much lower cloud sitting among higher cloud is darkened — the gaps between towers. */
const CAVITY = 1.6;
/** Radius, in pixels, of the neighbourhood those gaps are measured against. */
const CAVITY_RADIUS = 6;
/** Radius, in pixels, the lift is smoothed over: the layer's mesh has a vertex every four. */
const LIFT_RADIUS = 4;
/** Brightness of flat cloud, and how far slopes swing it either way. */
const FLAT = 0.84;
const SWING = 1.6;
/** Shaded cloud is a cool grey, lit cloud white. */
const SHADE_RGB = [112, 126, 148];

const smooth = (edge0: number, edge1: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Box blur of radius `r` over a square `w` wide, separable, edges clamped. Writes into `out`. */
function boxBlur(src: Float32Array, out: Float32Array, tmp: Float32Array, w: number, r: number) {
  const n = 2 * r + 1, last = w - 1;
  for (let j = 0; j < w; j++) {
    const row = j * w;
    let sum = 0;
    for (let d = -r; d <= r; d++) sum += src[row + Math.min(last, Math.max(0, d))];
    for (let i = 0; i < w; i++) {
      tmp[row + i] = sum / n;
      sum += src[row + Math.min(last, i + r + 1)] - src[row + Math.max(0, i - r)];
    }
  }
  for (let i = 0; i < w; i++) {
    let sum = 0;
    for (let d = -r; d <= r; d++) sum += tmp[Math.min(last, Math.max(0, d)) * w + i];
    for (let j = 0; j < w; j++) {
      out[j * w + i] = sum / n;
      sum += tmp[Math.min(last, j + r + 1) * w + i] - tmp[Math.max(0, j - r) * w + i];
    }
  }
}

/** Scratch space, reused tile to tile. */
const N = PADDED * PADDED;
const alpha = new Float32Array(N), height = new Float32Array(N), seen = new Float32Array(N), daylight = new Float32Array(N);
const alphaSoft = new Float32Array(N), heightSoft = new Float32Array(N), heightWide = new Float32Array(N), seenWide = new Float32Array(N), scratch = new Float32Array(N);
const mass = new Float32Array(N), massSoft = new Float32Array(N);

export interface CloudTile {
  /** Infrared, RGBA, PADDED × PADDED, greys already on the reference's scale. */
  ir: Uint8ClampedArray;
  /** Clear-sky infrared grey for each pixel, PADDED × PADDED — see tileClearSky. Tropical throughout when absent. */
  clear?: Float32Array;
  /** Visible, the same, or null when the tile is all night. */
  vis: Uint8ClampedArray | null;
  z: number; x: number; y: number;
  /** The frame's time, in ms, for the sun. */
  time: number;
}

export interface CloudImage {
  /** The cloud, RGBA, PADDED × PADDED with its margin: lit colour, and opacity in alpha. */
  rgba: Uint8ClampedArray<ArrayBuffer>;
  /** Cloud-top height, PADDED × PADDED, 0 for the lowest cloud to 255 for the highest — what the layer lifts each point by. */
  height: Uint8Array<ArrayBuffer>;
}

/**
 * The finished tile.
 *
 * Opacity comes from infrared — the colder, the thicker — and by day from
 * visible light too, which also catches low cloud infrared can't tell from the
 * sea. Brightness comes from relief: cloud-top height, read off infrared, lit
 * from the north-west, so towering storms stand up, with lower cloud in the
 * gaps between them falling into shade. By day the fine detail of the visible
 * band — real sunlit texture — is laid over that. The height goes out too, so
 * the layer can lift each cloud to its own altitude and cast its shadow.
 */
export function renderClouds({ ir, clear, vis, z, x, y, time }: CloudTile): CloudImage {
  // Sun elevation is separable: a term per row plus a term per row times one per column.
  const { lat, lng } = tileGrid(z, x, y);
  const { sinDec, cosDec, subsolar } = sunTerms(time);
  const rowSin = lat.map(l => Math.sin(l) * sinDec);
  const rowCos = lat.map(l => Math.cos(l) * cosDec);
  const colCos = lng.map(l => Math.cos(l - subsolar));

  for (let j = 0; j < PADDED; j++) {
    // Cloud is measured against how cold clear ground is here, not one grey
    // for the world: the sea off Greenland is as cold as cloud over the
    // tropics, and a single threshold veiled the whole far north.
    // Toward 73°, the edge of what the satellites see, they see it at a
    // grazing angle: the infrared reads falsely cold and smeared, and came out
    // as a flat white sheet over the Arctic. Faded out, which also softens the
    // hard rim the coverage left on the globe.
    const rim = 1 - smooth(RIM_START, RIM_END, Math.abs(lat[j]));
    for (let i = 0; i < PADDED; i++) {
      const k = j * PADDED + i, p = k * 4;
      const ground = clear ? clear[k] : TROPICAL_CLEAR;
      const span = 255 - ground;
      const cloudFrom = ground + COLD_CLEAR * span;
      const covered = ir[p + 3] / 255;
      const cold = smooth(COLD_CLEAR, COLD_SOLID, (ir[p] - ground) / span);
      const rise = Math.min(1, Math.max(0, (ir[p] - cloudFrom) / (IR_TOP - cloudFrom)));
      let a = cold;
      if (vis && vis[p + 3] > 0) {
        const elevation = rowSin[j] + rowCos[j] * colCos[i];
        const day = smooth(DAWN, DAY, elevation);
        if (day > 0) {
          // A low sun lights cloud dimly; divide that out, as satellite
          // imagery is corrected for sun angle, or evening cloud goes grey.
          // Only for its texture: brightened, low-sun sea glare passed for
          // cloud and hazed the whole evening side, so opacity reads it raw.
          const v = Math.min(255, vis[p] / (LOW_SUN + (1 - LOW_SUN) * smooth(0, HIGH_SUN, elevation)));
          a = Math.max(a, day * smooth(VIS_CLEAR, VIS_SOLID, vis[p]) * smooth(IR_HOT, IR_HOT + 20, ir[p]));
          seen[k] = v / 255;
        } else {
          seen[k] = 0;
        }
        daylight[k] = day;
      } else {
        seen[k] = daylight[k] = 0;
      }
      alpha[k] = a * covered * rim;
      mass[k] = alpha[k] * rise;
      height[k] = rise;
    }
  }

  boxBlur(alpha, alphaSoft, scratch, PADDED, 1);
  if (vis) boxBlur(seen, seenWide, scratch, PADDED, TEXTURE_RADIUS);
  // Radius 2: the infrared comes in whole grey steps, and relief would light each step as a ridge.
  boxBlur(height, heightSoft, scratch, PADDED, 2);
  boxBlur(height, heightWide, scratch, PADDED, CAVITY_RADIUS);
  // What the layer lifts the mesh by: height where there is cloud to carry it,
  // so thin cloud stays on the deck, smoothed to about the mesh's own spacing
  // so a tower rises as a dome rather than one vertex spiking.
  boxBlur(mass, massSoft, scratch, PADDED, LIFT_RADIUS);
  const relief = RELIEF * RELIEF_PER_ZOOM ** (z - 4);

  // The margin goes out with the tile: the layer reads across it for shadows
  // and relief, so they carry over tile edges instead of stopping at them.
  const out = new Uint8ClampedArray(N * 4);
  const lift = new Uint8Array(N);
  const [lx, ly, lz] = LIGHT;
  for (let j = 0; j < PADDED; j++) {
    for (let i = 0; i < PADDED; i++) {
      const k = j * PADDED + i;
      const o = k * 4;
      lift[k] = Math.round(massSoft[k] * 255);
      const a = alphaSoft[k];
      if (a < 0.004) continue; // already transparent
      const west = i > 0 ? k - 1 : k, east = i < PADDED - 1 ? k + 1 : k;
      const north = j > 0 ? k - PADDED : k, south = j < PADDED - 1 ? k + PADDED : k;

      // Surface normal of the cloud tops, from the height field's slope. Thin
      // cloud — cirrus, veils — is lit nearly flat: it has no tops to catch the
      // light, and relief made a cirrus plume read as a field of cumulus.
      const bumps = relief * a * a;
      const dx = (heightSoft[east] - heightSoft[west]) * 0.5 * bumps;
      const dy = (heightSoft[south] - heightSoft[north]) * 0.5 * bumps;
      const facing = (-dx * lx - dy * ly + lz) / Math.sqrt(dx * dx + dy * dy + 1);
      const occlusion = 1 - Math.min(0.6, CAVITY * Math.max(0, heightWide[k] - heightSoft[k]));
      // By day, the visible band's own detail: how much brighter or darker each
      // pixel is than its surroundings. Only the detail — how thin a cloud is
      // already shows as transparency, and greying it as well made veils smoky.
      const texture = vis ? 1 + daylight[k] * TEXTURE * (seen[k] - seenWide[k]) : 1;
      const lum = Math.min(1, Math.max(0, (FLAT + SWING * (facing - lz)) * occlusion * texture));

      const r = SHADE_RGB[0] + (255 - SHADE_RGB[0]) * lum;
      const g = SHADE_RGB[1] + (255 - SHADE_RGB[1]) * lum;
      const b = SHADE_RGB[2] + (255 - SHADE_RGB[2]) * lum;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a * 255;
    }
  }
  return { rgba: out, height: lift };
}
