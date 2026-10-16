import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';
import { MAP_INK } from '@/lib/map/style/tokens';
import { windAt, type WindField } from './wind-field';

/*
 * Wind as moving streaks: particles carried by the GFS 10 m field over the view, each leaving a short
 * fading trail, coloured by speed. Positions step on the CPU in Web Mercator and are drawn as one batch
 * of lines; projection comes from MapLibre's prelude (see replay/track-layer.ts), so it works on the
 * globe and the flat map. It animates only while drawn, and stands still for reduced motion.
 */

/** Positions kept per particle: the head and the trail behind it. */
const TRAIL = 10;
/** Steps a second; each redraws the whole map, so not every display frame. */
const STEP_MS = 33;
/** Screen distance, in CSS pixels per step for each m/s. */
const PX_PER_MS = 0.2;
const MIN_AGE = 45;
const MAX_AGE = 110;
/** One particle per this many CSS pixels of map. */
const PIXELS_PER_PARTICLE = 450;
const MAX_PARTICLES = 4500;
const MIN_PARTICLES = 800;
/** For reduced motion: steps taken once so the still streaks still show which way it blows. */
const STILL_STEPS = TRAIL * 2;

const VERT = `
in vec2 a_pos;
in vec4 a_color;
out vec4 v_color;
void main() {
  gl_Position = projectTileFor3D(a_pos, 0.0);
  v_color = a_color;
}`;

const FRAG = `
precision mediump float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}`;

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
/** m/s to colour: calm teal, a breeze sand, a gale red. */
const RAMP: [number, [number, number, number]][] = [[0, rgb(MAP_INK.teal)], [8, rgb(MAP_INK.sand)], [20, rgb(MAP_INK.red)]];
function speedColor(ms: number, out: Uint8Array, o: number) {
  let i = 0;
  while (i < RAMP.length - 2 && ms > RAMP[i + 1][0]) i++;
  const [s0, c0] = RAMP[i], [s1, c1] = RAMP[i + 1];
  const t = Math.max(0, Math.min(1, (ms - s0) / (s1 - s0)));
  for (let c = 0; c < 3; c++) out[o + c] = c0[c] + (c1[c] - c0[c]) * t;
}

const toLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
const mercY = (lat: number) => {
  const l = Math.max(-85, Math.min(85, lat)) * (Math.PI / 180);
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + l / 2)) / (2 * Math.PI);
};
const WORLD = { x0: 0, x1: 1, y0: mercY(80), y1: mercY(-80) };

export type WindLayer = CustomLayerInterface & {
  setField(field: WindField | null): void;
};

export function createWindLayer(id: string): WindLayer {
  let gl: WebGL2RenderingContext | null = null;
  let map: MlMap | null = null;
  let posBuffer: WebGLBuffer | null = null;
  let colorBuffer: WebGLBuffer | null = null;
  const programs = new Map<string, WebGLProgram>();
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let field: WindField | null = null;
  let n = 0;
  /** Trails in Mercator, newest first: particle i's point k is at (i * TRAIL + k) * 2. */
  let trail = new Float32Array(0);
  let speed = new Float32Array(0);
  let filled = new Uint8Array(0);
  let age = new Uint16Array(0);
  let life = new Uint16Array(0);
  let positions = new Float32Array(0);
  let colors = new Uint8Array(0);
  let lastStep = 0;
  let repaint: ReturnType<typeof setTimeout> | undefined;
  /** Where particles are seeded: the view, in Mercator. */
  let box = WORLD;
  const wind: [number, number] = [0, 0];

  const viewBox = () => {
    if (!map) return;
    const b = map.getBounds();
    // A far-out globe or a world-wide view seeds everywhere.
    if (map.getZoom() < 2.5 || b.getEast() - b.getWest() >= 300) box = WORLD;
    else box = { x0: (b.getWest() + 180) / 360, x1: (b.getEast() + 180) / 360, y0: mercY(Math.min(85, b.getNorth())), y1: mercY(Math.max(-85, b.getSouth())) };
  };

  const spawn = (i: number) => {
    const o = i * TRAIL * 2;
    const x = box.x0 + Math.random() * (box.x1 - box.x0);
    trail[o] = ((x % 1) + 1) % 1;
    trail[o + 1] = box.y0 + Math.random() * (box.y1 - box.y0);
    filled[i] = 1;
    age[i] = 0;
    life[i] = MIN_AGE + Math.floor(Math.random() * (MAX_AGE - MIN_AGE));
  };

  const resize = () => {
    if (!map) return;
    const c = map.getCanvas();
    const want = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, Math.round((c.clientWidth * c.clientHeight) / PIXELS_PER_PARTICLE)));
    if (want === n) return;
    n = want;
    trail = new Float32Array(n * TRAIL * 2);
    speed = new Float32Array(n);
    filled = new Uint8Array(n);
    age = new Uint16Array(n);
    life = new Uint16Array(n);
    positions = new Float32Array(n * (TRAIL - 1) * 4);
    colors = new Uint8Array(n * (TRAIL - 1) * 8);
    viewBox();
    for (let i = 0; i < n; i++) {
      spawn(i);
      // Staggered, so they don't all expire together.
      age[i] = Math.floor(Math.random() * life[i]);
    }
  };

  const step = () => {
    if (!map || !field) return;
    // Mercator units per CSS pixel at this zoom (512 px tiles).
    const unit = PX_PER_MS / (512 * 2 ** map.getZoom());
    for (let i = 0; i < n; i++) {
      const o = i * TRAIL * 2;
      const x = trail[o], y = trail[o + 1];
      const lat = toLat(y);
      if (++age[i] > life[i] || y < box.y0 - 0.02 || y > box.y1 + 0.02 || !windAt(field, lat, x * 360 - 180, wind)) {
        spawn(i);
        continue;
      }
      speed[i] = Math.hypot(wind[0], wind[1]);
      // A metre is longer on the Mercator plane away from the equator.
      const stretch = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      trail.copyWithin(o + 2, o, o + (TRAIL - 1) * 2);
      trail[o] = (((x + wind[0] * unit * stretch) % 1) + 1) % 1;
      trail[o + 1] = y - wind[1] * unit * stretch;
      if (filled[i] < TRAIL) filled[i]++;
    }
  };

  /** Line pieces from each particle's head back along its trail, fading with age. */
  const build = () => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const o = i * TRAIL * 2;
      // Fade in after a respawn and out before the next.
      const life01 = Math.min(1, age[i] / 6, (life[i] - age[i]) / 6);
      for (let k = 0; k < filled[i] - 1; k++) {
        const a = o + k * 2;
        if (Math.abs(trail[a] - trail[a + 2]) > 0.5) continue;
        const alpha = 230 * (1 - k / (TRAIL - 1)) * life01;
        for (let end = 0; end < 2; end++) {
          positions[v * 2] = trail[a + end * 2];
          positions[v * 2 + 1] = trail[a + end * 2 + 1];
          speedColor(speed[i], colors, v * 4);
          colors[v * 4 + 3] = alpha;
          v++;
        }
      }
    }
    return v;
  };

  const compile = (type: number, src: string) => {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(`wind layer shader: ${gl!.getShaderInfoLog(s)}`);
    return s;
  };
  /** One program per projection variant: one built for the globe draws nothing on the flat map. */
  const programFor = (shader: NonNullable<CustomRenderMethodInput['shaderData']>) => {
    const key = `${shader.variantName}\0${shader.define ?? ''}`;
    let p = programs.get(key);
    if (!p) {
      p = gl!.createProgram()!;
      gl!.attachShader(p, compile(gl!.VERTEX_SHADER, `#version 300 es\n${shader.vertexShaderPrelude}\n${shader.define ?? ''}\n${VERT}`));
      gl!.attachShader(p, compile(gl!.FRAGMENT_SHADER, `#version 300 es\n${FRAG}`));
      gl!.linkProgram(p);
      if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) throw new Error(`wind layer link: ${gl!.getProgramInfoLog(p)}`);
      programs.set(key, p);
    }
    return p;
  };

  const attribute = (p: WebGLProgram, name: string, buffer: WebGLBuffer, data: Float32Array | Uint8Array, size: number, type: number, normalized: boolean) => {
    const loc = gl!.getAttribLocation(p, name);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.DYNAMIC_DRAW);
    if (loc < 0) return;
    gl!.enableVertexAttribArray(loc);
    gl!.vertexAttribPointer(loc, size, type, normalized, 0, 0);
    gl!.vertexAttribDivisor(loc, 0);
  };

  const onMove = () => viewBox();

  return {
    id,
    type: 'custom',
    renderingMode: '2d',

    setField(next) {
      field = next;
      if (reduced && field) for (let s = 0; s < STILL_STEPS; s++) step();
      map?.triggerRepaint();
    },

    onAdd(m: MlMap, context: WebGL2RenderingContext) {
      map = m;
      gl = context;
      posBuffer = gl.createBuffer();
      colorBuffer = gl.createBuffer();
      resize();
      map.on('moveend', onMove);
      map.on('resize', resize);
    },

    onRemove() {
      clearTimeout(repaint);
      repaint = undefined;
      map?.off('moveend', onMove);
      map?.off('resize', resize);
      if (gl) {
        programs.forEach(p => gl!.deleteProgram(p));
        for (const b of [posBuffer, colorBuffer]) if (b) gl.deleteBuffer(b);
      }
      programs.clear();
      gl = null;
      map = null;
    },

    render(_context: WebGL2RenderingContext | WebGLRenderingContext, args: CustomRenderMethodInput) {
      if (!gl || !map || !posBuffer || !colorBuffer || !field) return;
      const shader = args?.shaderData;
      const proj = args?.defaultProjectionData;
      if (!shader?.vertexShaderPrelude || !proj) return;
      let p: WebGLProgram;
      try {
        p = programFor(shader);
      } catch (err) {
        console.error('[TAKIP] wind layer:', err instanceof Error ? err.message : err);
        return;
      }

      const now = performance.now();
      if (!reduced && now - lastStep >= STEP_MS) {
        // Catch up after a slow frame, a little, so the speed on screen stays true.
        const steps = lastStep ? Math.min(3, Math.round((now - lastStep) / STEP_MS)) : 1;
        for (let s = 0; s < steps; s++) step();
        lastStep = now;
      }
      const count = build();

      gl.useProgram(p);
      const u = (name: string) => gl!.getUniformLocation(p, name);
      gl.uniformMatrix4fv(u('u_projection_matrix'), false, proj.mainMatrix);
      gl.uniform4f(u('u_projection_tile_mercator_coords'), ...(proj.tileMercatorCoords as [number, number, number, number]));
      gl.uniform4f(u('u_projection_clipping_plane'), ...(proj.clippingPlane as [number, number, number, number]));
      gl.uniform1f(u('u_projection_transition'), proj.projectionTransition);
      gl.uniformMatrix4fv(u('u_projection_fallback_matrix'), false, proj.fallbackMatrix);

      attribute(p, 'a_pos', posBuffer, positions.subarray(0, count * 2), 2, gl.FLOAT, false);
      attribute(p, 'a_color', colorBuffer, colors.subarray(0, count * 4), 4, gl.UNSIGNED_BYTE, true);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.drawArrays(gl.LINES, 0, count);

      if (!reduced && !repaint) repaint = setTimeout(() => { repaint = undefined; map?.triggerRepaint(); }, STEP_MS);
    },
  };
}
