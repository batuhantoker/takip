import { project, type View } from '../globe-geometry';
import type { Disc } from '../globe-scene';

export interface CityPing {
  lon: number;
  lat: number;
  /** Earliest second it may light. */
  at: number;
  /** When it first lit on the visible side; cities turning into view ping as they arrive. */
  seenAt: number | null;
}

const RING = 1.5;
const TAU = Math.PI * 2;

export function drawCities(ctx: CanvasRenderingContext2D, { cx, cy, r }: Disc, view: View, cities: CityPing[], t: number, still: boolean) {
  const s = r / 200;
  for (const c of cities) {
    if (!still && t < c.at) continue;
    const [x, y, z] = project(c.lon, c.lat, view);
    if (z < 0.04) continue;
    c.seenAt ??= still ? -Infinity : t;
    const age = t - c.seenAt;
    const fade = Math.min(1, z / 0.25);
    const px = cx + x * r;
    const py = cy + y * r;

    if (age < RING) {
      const k = age / RING;
      ctx.strokeStyle = `rgba(0,229,255,${(0.85 * (1 - k) ** 2 * fade).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px, py, (2 + 20 * (1 - (1 - k) ** 3)) * s, 0, TAU);
      ctx.stroke();
    }
    const pop = age < 0.3 ? 1 + 0.9 * Math.sin((age / 0.3) * Math.PI) : 1;
    ctx.fillStyle = `rgba(0,229,255,${(0.2 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px, py, 6 * s * pop, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(214,251,255,${fade.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px, py, 2 * s * pop, 0, TAU);
    ctx.fill();
  }
}
