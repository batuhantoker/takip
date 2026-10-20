import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';
import type { DecodedTrack } from '@takip/core/trk';
import { MAP_INK } from '@/lib/map/style/tokens';
import { at, fixAt, sample, type ReplayEntity } from './track-sample';

/*
 * Replay ships and aircraft as one WebGL layer (replay-database.md §8.3). Positions are interpolated
 * on the CPU into a reused typed array and drawn as instanced quads; nothing goes through GeoJSON,
 * so a frame costs a binary search per entity and one buffer upload. Projection comes from
 * MapLibre's prelude, as in satellite-layer.ts, so the globe and the flat map both work and the
 * globe's far side is clipped by the prelude's own z.
 */

export const TRAIL_S = 10 * 60;

const INSTANCE_FLOATS = 8; // x, y, heading, r, g, b, alpha, kind
const TRAIL_FLOATS = 6; // x, y, dt, r, g, b
/** The trail buffer holds [t - TRAIL - slack, t + slack]; it is rebuilt once the clock leaves that. */
const TRAIL_SLACK_S = 120;

const MARKER_VERT = `
in vec2 a_corner;
in vec2 a_pos;
in float a_heading;
in vec4 a_color;
in float a_kind;
uniform vec2 u_viewport;
uniform float u_size;
uniform float u_bearing;
uniform float u_zoom;
out vec2 v_corner;
out vec4 v_color;
flat out float v_shape;
void main() {
  vec4 clip = projectTileFor3D(a_pos, 0.0);
  // 0 aircraft, 1 ship arrow, 2 ship dot (below zoom 6, as the live layer).
  float shape = a_kind < 0.5 ? 0.0 : (u_zoom < 6.0 ? 2.0 : 1.0);
  float size = shape > 1.5 ? max(2.5, u_size * 0.3) : u_size;
  float ang = a_heading - u_bearing;
  vec2 r = vec2(a_corner.x * cos(ang) + a_corner.y * sin(ang), -a_corner.x * sin(ang) + a_corner.y * cos(ang));
  gl_Position = clip + vec4(r * size / u_viewport * 2.0 * clip.w, 0.0, 0.0);
  v_corner = a_corner;
  v_color = a_color;
  v_shape = shape;
}`;

const MARKER_FRAG = `
precision mediump float;
in vec2 v_corner;
in vec4 v_color;
flat in float v_shape;
out vec4 fragColor;
bool plane(vec2 p) {
  float ax = abs(p.x);
  bool body = ax < 0.13 && p.y > -0.85 && p.y < 0.95;
  bool wing = ax < 0.92 && p.y < 0.2 - 0.42 * ax && p.y > -0.06 - 0.42 * ax;
  bool tail = ax < 0.4 && p.y < -0.58 - 0.2 * ax && p.y > -0.86;
  return body || wing || tail;
}
bool arrow(vec2 p) {
  float ax = abs(p.x);
  return p.y < 0.9 && p.y > -0.8 && ax <= (0.9 - p.y) * 0.382 && p.y >= -0.35 - ax * 0.692;
}
void main() {
  bool inside = v_shape < 0.5 ? plane(v_corner) : v_shape < 1.5 ? arrow(v_corner) : dot(v_corner, v_corner) < 1.0;
  if (!inside) discard;
  fragColor = vec4(v_color.rgb, v_color.a);
}`;

const TRAIL_VERT = `
in vec2 a_pos;
in float a_dt;
in vec3 a_color;
out float v_dt;
out vec3 v_color;
void main() {
  gl_Position = projectTileFor3D(a_pos, 0.0);
  v_dt = a_dt;
  v_color = a_color;
}`;

const TRAIL_FRAG = `
precision mediump float;
in float v_dt;
in vec3 v_color;
uniform float u_t;
uniform float u_trail;
out vec4 fragColor;
void main() {
  // Offsets from the buffer's base time: float32 can't hold epoch seconds (128 s steps).
  float age = u_t - v_dt;
  if (age < 0.0 || age > u_trail) discard;
  fragColor = vec4(v_color, 0.55 * (1.0 - age / u_trail));
}`;

const SELECTED = [1, 3, 5].map(i => parseInt(MAP_INK.ink1.slice(i, i + 2), 16) / 255);

const mercX = (lon: number) => (lon + 180) / 360;
const mercY = (lat: number) => {
  const l = Math.max(-85.0511, Math.min(85.0511, lat)) * (Math.PI / 180);
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + l / 2)) / (2 * Math.PI);
};
type Programs = { marker: WebGLProgram; trail: WebGLProgram };

export function createReplayTrackLayer(id: string, { onCount }: { onCount?: (shown: number) => void } = {}): CustomLayerInterface & {
  setEntities(list: ReplayEntity[]): void;
  /** Which entities to draw, given their current speed in knots (the "underway" ship filter needs it). */
  setFilter(show: (e: ReplayEntity, speedKn: number) => boolean): void;
  /** Epoch seconds. */
  setTime(t: number): void;
  /** Draws this entity on top, in the selection colour; null clears it. */
  setSelected(entity: number | null): void;
  /** The drawn entity nearest a screen point, within `slop` px; `visible` rules out the globe's far side. */
  pick(x: number, y: number, slop: number, visible?: (lon: number, lat: number) => boolean): ReplayEntity | null;
  /** Every entity drawn at the current time. */
  drawn(): ReplayEntity[];
} {
  let gl: WebGL2RenderingContext | null = null;
  let map: MlMap | null = null;
  let quad: WebGLBuffer | null = null;
  let instances: WebGLBuffer | null = null;
  let trails: WebGLBuffer | null = null;
  const programs = new Map<string, Programs>();

  let entities: ReplayEntity[] = [];
  let show: (e: ReplayEntity, speedKn: number) => boolean = () => true;
  let time = 0;
  let selected: number | null = null;
  let instanceData = new Float32Array(0);
  let instanceCount = 0;
  let trailData = new Float32Array(0);
  let trailCount = 0;
  let trailBase = Number.NaN;
  let dirty = true;
  let trailsDirty = true;

  const compile = (type: number, src: string) => {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      const log = gl!.getShaderInfoLog(s);
      gl!.deleteShader(s);
      throw new Error(`replay layer shader: ${log}`);
    }
    return s;
  };
  const link = (prelude: string, define: string, vert: string, frag: string) => {
    const pr = gl!.createProgram()!;
    const vs = compile(gl!.VERTEX_SHADER, `#version 300 es\n${prelude}\n${define}\n${vert}`);
    const fs = compile(gl!.FRAGMENT_SHADER, `#version 300 es\n${frag}`);
    gl!.attachShader(pr, vs);
    gl!.attachShader(pr, fs);
    gl!.linkProgram(pr);
    gl!.deleteShader(vs);
    gl!.deleteShader(fs);
    if (!gl!.getProgramParameter(pr, gl!.LINK_STATUS)) throw new Error(`replay layer link: ${gl!.getProgramInfoLog(pr)}`);
    return pr;
  };
  /** One pair of programs per projection variant: a program built for the globe draws nothing on the flat map. */
  const programsFor = (shader: NonNullable<CustomRenderMethodInput['shaderData']>) => {
    const key = `${shader.variantName}\0${shader.define ?? ''}`;
    let p = programs.get(key);
    if (!p) {
      p = {
        marker: link(shader.vertexShaderPrelude, shader.define ?? '', MARKER_VERT, MARKER_FRAG),
        trail: link(shader.vertexShaderPrelude, shader.define ?? '', TRAIL_VERT, TRAIL_FRAG),
      };
      programs.set(key, p);
    }
    return p;
  };

  const setProjection = (pr: WebGLProgram, proj: NonNullable<CustomRenderMethodInput['defaultProjectionData']>) => {
    const u = (name: string) => gl!.getUniformLocation(pr, name);
    gl!.uniformMatrix4fv(u('u_projection_matrix'), false, proj.mainMatrix);
    gl!.uniform4f(u('u_projection_tile_mercator_coords'), ...(proj.tileMercatorCoords as [number, number, number, number]));
    gl!.uniform4f(u('u_projection_clipping_plane'), ...(proj.clippingPlane as [number, number, number, number]));
    gl!.uniform1f(u('u_projection_transition'), proj.projectionTransition);
    gl!.uniformMatrix4fv(u('u_projection_fallback_matrix'), false, proj.fallbackMatrix);
  };

  const buildInstances = () => {
    if (instanceData.length < entities.length * INSTANCE_FLOATS) instanceData = new Float32Array(entities.length * INSTANCE_FLOATS);
    let n = 0;
    const put = (e: ReplayEntity, color: ArrayLike<number>, alpha: number) => {
      const o = n * INSTANCE_FLOATS;
      instanceData[o] = mercX(at.lon);
      instanceData[o + 1] = mercY(at.lat);
      instanceData[o + 2] = at.heading;
      instanceData[o + 3] = color[0];
      instanceData[o + 4] = color[1];
      instanceData[o + 5] = color[2];
      instanceData[o + 6] = alpha;
      instanceData[o + 7] = e.cls === 'vessel' ? 1 : 0;
      n++;
    };
    let pick: ReplayEntity | null = null;
    for (const e of entities) {
      if (e.entity === selected) { pick = e; continue; }
      if (sample(e, time) && show(e, at.speed)) put(e, e.color, at.alpha);
    }
    // Last, so it is drawn over the rest.
    if (pick && sample(pick, time) && show(pick, at.speed)) put(pick, SELECTED, Math.max(at.alpha, 0.9));
    instanceCount = n;
    onCount?.(n);
  };

  /** Line pieces of the measured tracks within the trail window, timed relative to `trailBase`. */
  const buildTrails = () => {
    trailBase = time;
    const lo = time - TRAIL_S - TRAIL_SLACK_S;
    const hi = time + TRAIL_SLACK_S;
    let total = 0;
    for (const e of entities) {
      for (const seg of e.segs) {
        if (seg.n < 2 || seg.t[seg.n - 1] < lo || seg.t[0] > hi) continue;
        const from = Math.max(0, fixAt(seg.t, lo));
        const to = Math.min(seg.n - 1, Math.max(0, fixAt(seg.t, hi)) + 1);
        total += Math.max(0, to - from) * 2;
      }
    }
    if (trailData.length < total * TRAIL_FLOATS) trailData = new Float32Array(Math.ceil(total * 1.5) * TRAIL_FLOATS);
    let v = 0;
    const put = (e: ReplayEntity, seg: DecodedTrack, i: number) => {
      const o = v * TRAIL_FLOATS;
      trailData[o] = mercX(seg.lon[i]);
      trailData[o + 1] = mercY(seg.lat[i]);
      trailData[o + 2] = seg.t[i] - trailBase;
      trailData[o + 3] = e.color[0];
      trailData[o + 4] = e.color[1];
      trailData[o + 5] = e.color[2];
      v++;
    };
    for (const e of entities) {
      if (!show(e, Number.POSITIVE_INFINITY)) continue;
      for (const seg of e.segs) {
        if (seg.n < 2 || seg.t[seg.n - 1] < lo || seg.t[0] > hi) continue;
        const from = Math.max(0, fixAt(seg.t, lo));
        const to = Math.min(seg.n - 1, Math.max(0, fixAt(seg.t, hi)) + 1);
        for (let i = from; i < to; i++) {
          put(e, seg, i);
          put(e, seg, i + 1);
        }
      }
    }
    trailCount = v;
  };

  const bindInstanced = (pr: WebGLProgram) => {
    const corner = gl!.getAttribLocation(pr, 'a_corner');
    gl!.bindBuffer(gl!.ARRAY_BUFFER, quad);
    gl!.enableVertexAttribArray(corner);
    gl!.vertexAttribPointer(corner, 2, gl!.FLOAT, false, 0, 0);
    gl!.vertexAttribDivisor(corner, 0);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, instances);
    const stride = INSTANCE_FLOATS * 4;
    const attrs = [['a_pos', 2, 0], ['a_heading', 1, 8], ['a_color', 4, 12], ['a_kind', 1, 28]] as const;
    for (const [name, size, offset] of attrs) {
      const loc = gl!.getAttribLocation(pr, name);
      if (loc < 0) continue;
      gl!.enableVertexAttribArray(loc);
      gl!.vertexAttribPointer(loc, size, gl!.FLOAT, false, stride, offset);
      gl!.vertexAttribDivisor(loc, 1);
    }
    // Divisors are global GL state: left set, they corrupt whichever layer draws next.
    return () => {
      for (const [name] of attrs) {
        const loc = gl!.getAttribLocation(pr, name);
        if (loc >= 0) gl!.vertexAttribDivisor(loc, 0);
      }
    };
  };

  return {
    id,
    type: 'custom',
    // Ground-level marks: no depth test against the globe (it would z-fight); the prelude's z clips the far side.
    renderingMode: '2d',

    setEntities(list) {
      entities = list;
      dirty = true;
      trailsDirty = true;
      map?.triggerRepaint();
    },
    setFilter(next) {
      show = next;
      dirty = true;
      trailsDirty = true;
      map?.triggerRepaint();
    },
    setSelected(entity) {
      if (entity === selected) return;
      selected = entity;
      dirty = true;
      map?.triggerRepaint();
    },
    pick(x, y, slop, visible = () => true) {
      if (!map) return null;
      let best: ReplayEntity | null = null;
      let bestD = slop * slop;
      for (const e of entities) {
        if (!sample(e, time) || !show(e, at.speed) || !visible(at.lon, at.lat)) continue;
        const p = map.project([at.lon, at.lat]);
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d <= bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    },
    drawn: () => entities.filter(e => sample(e, time) && show(e, at.speed)),
    setTime(t) {
      if (t === time) return;
      time = t;
      dirty = true;
      if (Number.isNaN(trailBase) || t < trailBase || t > trailBase + TRAIL_SLACK_S) trailsDirty = true;
      map?.triggerRepaint();
    },

    onAdd(m: MlMap, context: WebGL2RenderingContext) {
      map = m;
      gl = context;
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      instances = gl.createBuffer();
      trails = gl.createBuffer();
    },

    onRemove() {
      if (gl) {
        programs.forEach(p => {
          gl!.deleteProgram(p.marker);
          gl!.deleteProgram(p.trail);
        });
        for (const b of [quad, instances, trails]) if (b) gl.deleteBuffer(b);
      }
      programs.clear();
      gl = null;
      map = null;
    },

    render(_context: WebGL2RenderingContext | WebGLRenderingContext, args: CustomRenderMethodInput) {
      if (!gl || !map || !instances || !entities.length) return;
      const shader = args?.shaderData;
      const proj = args?.defaultProjectionData;
      if (!shader?.vertexShaderPrelude || !proj) return;
      let p: Programs;
      try {
        p = programsFor(shader);
      } catch (err) {
        console.error('[TAKIP] replay layer:', err instanceof Error ? err.message : err);
        return;
      }

      if (trailsDirty) {
        buildTrails();
        gl.bindBuffer(gl.ARRAY_BUFFER, trails);
        gl.bufferData(gl.ARRAY_BUFFER, trailData.subarray(0, trailCount * TRAIL_FLOATS), gl.DYNAMIC_DRAW);
        trailsDirty = false;
      }
      if (dirty) {
        buildInstances();
        gl.bindBuffer(gl.ARRAY_BUFFER, instances);
        gl.bufferData(gl.ARRAY_BUFFER, instanceData.subarray(0, instanceCount * INSTANCE_FLOATS), gl.DYNAMIC_DRAW);
        dirty = false;
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);

      // Trails first, under the marks they lead to.
      if (trailCount) {
        gl.useProgram(p.trail);
        setProjection(p.trail, proj);
        gl.uniform1f(gl.getUniformLocation(p.trail, 'u_t'), time - trailBase);
        gl.uniform1f(gl.getUniformLocation(p.trail, 'u_trail'), TRAIL_S);
        gl.bindBuffer(gl.ARRAY_BUFFER, trails);
        const stride = TRAIL_FLOATS * 4;
        for (const [name, size, offset] of [['a_pos', 2, 0], ['a_dt', 1, 8], ['a_color', 3, 12]] as const) {
          const loc = gl.getAttribLocation(p.trail, name);
          if (loc < 0) continue;
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
          gl.vertexAttribDivisor(loc, 0);
        }
        gl.drawArrays(gl.LINES, 0, trailCount);
      }

      if (instanceCount) {
        gl.useProgram(p.marker);
        setProjection(p.marker, proj);
        const zoom = map.getZoom();
        gl.uniform2f(gl.getUniformLocation(p.marker, 'u_viewport'), gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform1f(gl.getUniformLocation(p.marker, 'u_size'), Math.min(18, Math.max(6, 4 + zoom * 1.3)) * devicePixelRatio);
        gl.uniform1f(gl.getUniformLocation(p.marker, 'u_bearing'), map.getBearing() * (Math.PI / 180));
        gl.uniform1f(gl.getUniformLocation(p.marker, 'u_zoom'), zoom);
        const unbind = bindInstanced(p.marker);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
        unbind();
      }
    },
  };
}
