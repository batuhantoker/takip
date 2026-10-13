import { DEG, project, type View } from './globe-geometry';
import type { Disc } from './globe-scene';

const STEP = 4;

/** Meridians and parallels every 30°, front hemisphere only: the mark's grid on the live globe. */
export function drawGraticule(ctx: CanvasRenderingContext2D, { cx, cy, r }: Disc, view: View, alpha: number) {
  if (alpha <= 0) return;
  ctx.beginPath();
  const trace = (at: (k: number) => [number, number], steps: number) => {
    let pen = false;
    for (let k = 0; k <= steps; k++) {
      const [lon, lat] = at(k);
      const [x, y, z] = project(lon * DEG, lat * DEG, view);
      if (z < 0) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(cx + x * r, cy + y * r);
      else ctx.moveTo(cx + x * r, cy + y * r);
      pen = true;
    }
  };
  for (let lon = -180; lon < 180; lon += 30) trace(k => [lon, -90 + k * STEP], 180 / STEP);
  for (let lat = -60; lat <= 60; lat += 30) trace(k => [-180 + k * STEP, lat], 360 / STEP);
  ctx.strokeStyle = `rgba(120,165,255,${alpha.toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}
