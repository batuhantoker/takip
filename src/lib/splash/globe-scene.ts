import { LANDING_CITIES } from '@/lib/places/landing-cities';
import { DEG, landPoints, makeView, subsolar, sunDot } from './globe-geometry';
import { drawOrbit, satelliteAngle } from './draw-orbit';
import { drawCities, type CityPing } from './draw-cities';
import { drawGraticule } from './draw-graticule';
import { facingLongitude, mapGlobe, splashGlobeRadius } from './map-handoff';

export interface Disc {
  cx: number;
  cy: number;
  r: number;
}

const SAMPLES = 15000;
/* Spins in from the east and settles on the longitude the map opens on, ready for the handoff. */
const SPIN_IN = 55 * DEG;
const SETTLE = 0.9;
const BUCKETS = 6;

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/* Dim dots lean brand blue, bright ones brand ink, so the limb reads as depth. */
const LAND_FILLS = Array.from({ length: BUCKETS }, (_, b) => {
  const f = (b + 0.5) / BUCKETS;
  const mix = (from: number, to: number) => Math.round(from + (to - from) * f ** 0.9);
  return `rgba(${mix(47, 242)},${mix(128, 245)},${mix(255, 250)},${(0.22 + 0.78 * f).toFixed(3)})`;
});

function paintSphere(w: number, h: number, dpr: number, { cx, cy, r }: Disc): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d');
  if (!g) return c;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const halo = g.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.3);
  halo.addColorStop(0, 'rgba(47,128,255,0.22)');
  halo.addColorStop(0.3, 'rgba(47,128,255,0.07)');
  halo.addColorStop(1, 'rgba(47,128,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, w, h);

  // Opaque, so it hides the back half of the orbit drawn before it.
  const body = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx, cy, r * 1.05);
  body.addColorStop(0, '#0f1b33');
  body.addColorStop(0.65, '#080f1f');
  body.addColorStop(1, '#050913');
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();

  const rim = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r);
  rim.addColorStop(0, 'rgba(47,128,255,0)');
  rim.addColorStop(1, 'rgba(47,128,255,0.16)');
  g.fillStyle = rim;
  g.fill();
  g.strokeStyle = 'rgba(140,185,255,0.35)';
  g.lineWidth = 1;
  g.stroke();
  return c;
}

/** The splash globe: dotted land lit by today's sun, an orbit and pings at the landing cities. */
export function createGlobeScene() {
  const facing = facingLongitude();
  const tilt = mapGlobe(window.innerWidth, window.innerHeight).lat;
  const pts = landPoints(SAMPLES);
  const sun = subsolar(new Date());
  const light = new Float32Array(pts.count);
  for (let i = 0; i < pts.count; i++) {
    light[i] = 0.42 + 0.58 * smooth(-0.08, 0.12, sunDot(pts.lon[i], pts.cosLat[i], pts.sinLat[i], sun));
  }
  const xs = new Float32Array(pts.count);
  const ys = new Float32Array(pts.count);
  const ss = new Float32Array(pts.count);
  const bk = new Uint8Array(pts.count);

  const cities: CityPing[] = LANDING_CITIES.map((c, i) => ({
    lon: c.lng * DEG,
    lat: c.lat * DEG,
    at: 0.55 + ((i * 7) % LANDING_CITIES.length) * 0.11,
    seenAt: null,
  }));

  let w = 0;
  let h = 0;
  let disc: Disc = { cx: 0, cy: 0, r: 0 };
  let sphere: HTMLCanvasElement | null = null;

  function resize(width: number, height: number, dpr: number) {
    w = width;
    h = height;
    disc = { cx: w / 2, cy: h / 2, r: splashGlobeRadius(w, h) };
    sphere = paintSphere(w, h, dpr, disc);
  }

  function drawLand(ctx: CanvasRenderingContext2D, lon0: number, t: number) {
    const { cx, cy, r } = disc;
    const sinT = Math.sin(tilt);
    const cosT = Math.cos(tilt);
    const dot = r * 0.013;
    let m = 0;
    for (let i = 0; i < pts.count; i++) {
      const d = pts.lon[i] - lon0;
      const cl = pts.cosLat[i];
      const sl = pts.sinLat[i];
      const z0 = cl * Math.cos(d);
      const z = sl * sinT + z0 * cosT;
      // Projected density grows as 1/z; thinning the limb keeps it from banding.
      if (z <= 0.01 || pts.seed[i] > z * 3.5) continue;
      const grow = Math.min(1, (t - 0.1 - pts.seed[i] * 0.9) / 0.35);
      if (grow <= 0) continue;
      xs[m] = cx + cl * Math.sin(d) * r;
      ys[m] = cy - (sl * cosT - z0 * sinT) * r;
      ss[m] = dot * (0.4 + 0.6 * z) * grow;
      bk[m] = Math.min(BUCKETS - 1, ((0.06 + 0.94 * z ** 0.75) * light[i] * BUCKETS) | 0);
      m++;
    }
    for (let b = 0; b < BUCKETS; b++) {
      ctx.fillStyle = LAND_FILLS[b];
      for (let j = 0; j < m; j++) {
        if (bk[j] !== b) continue;
        const s = ss[j];
        ctx.fillRect(xs[j] - s / 2, ys[j] - s / 2, s, s);
      }
    }
  }

  /** `t` is seconds since the splash appeared; `readyAt` when the map reported ready. */
  function draw(ctx: CanvasRenderingContext2D, t: number, readyAt: number | null, still: boolean) {
    if (!sphere) return;
    const lon0 = still ? facing : facing + SPIN_IN * Math.exp(-t / SETTLE);
    const sat = satelliteAngle(t, still);
    ctx.clearRect(0, 0, w, h);
    drawOrbit(ctx, disc, sat, 'back');
    ctx.drawImage(sphere, 0, 0, w, h);
    const view = makeView(lon0, tilt);
    drawGraticule(ctx, disc, view, 0.07 * Math.min(1, still ? 1 : t / 0.8));
    drawLand(ctx, lon0, still ? 99 : t);
    drawCities(ctx, disc, view, cities, t, still);
    drawOrbit(ctx, disc, sat, 'front');

    if (readyAt !== null && !still && t - readyAt < 1) {
      const k = t - readyAt;
      ctx.strokeStyle = `rgba(47,128,255,${(0.55 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(disc.cx, disc.cy, disc.r * (1 + 0.22 * (1 - (1 - k) ** 3)), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return { resize, draw };
}
