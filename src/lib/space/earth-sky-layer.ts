import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';
import { mul, type Mat3 } from './frames';
import { jdFromMs } from './horizons';
import { cameraPosition, equatorialOfDateToGlobe, hiddenByGlobe, j2000ToGlobe, raDecVector, starColor, toScreen } from './sky-projection';

/**
 * TAKIP — a little of the real sky behind the Earth globe: the bright stars,
 * a few figures people know, the Sun, the Moon in its current phase and the
 * planets, each where it actually is right now.
 *
 * Drawn first, under the globe, through MapLibre's own globe matrix (see
 * sky-projection), so the globe hides whatever is behind it and everything
 * turns with the sky as Earth rotates. It stands aside as the map zooms in.
 */

export interface StarCatalog {
  stars: [number, number, number, number][];
  names: Record<string, string>;
  asterisms: [number, number][];
}

export interface SkyMark {
  name: string;
  kind: 'sun' | 'moon' | 'planet';
  /** RA/Dec of date, degrees. */
  ra: number;
  dec: number;
  /** Earth radii; Infinity for anything far enough to have no parallax here. */
  dist: number;
  color: string;
  /** The Moon's lit fraction and elongation from the Sun (0–360°). */
  illum?: number;
}

const LABEL_MAG = 1.7;
const FADE_FROM_ZOOM = 3;
const FADE_TO_ZOOM = 4.6;

// Custom layers draw after the opaque globe, so what is behind Earth is dropped
// by a ray test against the unit sphere rather than left to the depth buffer.
const BEHIND_GLOBE = `
uniform vec3 u_cam;
bool behindGlobe(vec3 d, float dist) {
  d = normalize(d);
  float b = dot(u_cam, d);
  float disc = b * b - (dot(u_cam, u_cam) - 1.0);
  if (disc <= 0.0) return false;
  float t = -b - sqrt(disc);
  return t > 0.0 && t < dist;
}`;

const STAR_VERT = `#version 300 es
uniform mat4 u_matrix;
uniform mat3 u_sky;
uniform float u_ratio;
uniform float u_alpha;
${BEHIND_GLOBE}
in vec3 a_dir;
in vec4 a_style; // size, r, g, b
in float a_bright;
out vec4 v_color;
void main() {
  vec3 d = u_sky * a_dir;
  vec4 c = u_matrix * vec4(d, 0.0);
  if (c.w <= 0.0 || behindGlobe(d, 1e9)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  gl_Position = vec4(c.xy, c.w * 0.99999, c.w);
  gl_PointSize = a_style.x * u_ratio;
  v_color = vec4(a_style.yzw, a_bright * u_alpha);
}`;

const STAR_FRAG = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 frag;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  frag = vec4(v_color.rgb, v_color.a * smoothstep(1.0, 0.15, r));
}`;

const LINE_VERT = `#version 300 es
uniform mat4 u_matrix;
uniform mat3 u_sky;
in vec3 a_dir;
out vec3 v_dir;
void main() {
  v_dir = u_sky * a_dir;
  vec4 c = u_matrix * vec4(v_dir, 0.0);
  gl_Position = c.w <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(c.xy, c.w * 0.99999, c.w);
}`;

const LINE_FRAG = `#version 300 es
precision highp float;
uniform float u_alpha;
${BEHIND_GLOBE}
in vec3 v_dir;
out vec4 frag;
void main() {
  if (behindGlobe(v_dir, 1e9)) discard;
  frag = vec4(0.62, 0.72, 1.0, 0.16 * u_alpha);
}`;

// Marks: a_pos is already in globe units (w = 0 for directions); a_light is the
// screen direction to the Sun and the cosine of the Moon's phase angle.
const MARK_VERT = `#version 300 es
uniform mat4 u_matrix;
uniform float u_ratio;
uniform float u_alpha;
${BEHIND_GLOBE}
in vec4 a_pos;
in vec4 a_style; // size, r, g, b
in vec4 a_kind;  // kind, light x, light y, cos(phase angle)
out vec3 v_color;
out vec4 v_kind;
out float v_alpha;
void main() {
  vec4 c = u_matrix * a_pos;
  vec3 d = a_pos.w > 0.5 ? a_pos.xyz - u_cam : a_pos.xyz;
  if (c.w <= 0.0 || behindGlobe(d, a_pos.w > 0.5 ? length(d) : 1e9)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  gl_Position = vec4(c.xy, c.w * 0.99999, c.w);
  gl_PointSize = a_style.x * u_ratio;
  v_color = a_style.yzw;
  v_kind = a_kind;
  v_alpha = u_alpha;
}`;

const MARK_FRAG = `#version 300 es
precision mediump float;
in vec3 v_color;
in vec4 v_kind;
in float v_alpha;
out vec4 frag;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  p.y = -p.y;
  float r = length(p);
  if (r > 1.0) discard;
  if (v_kind.x < 0.5) {
    // The Sun: a hot core inside a wide glow.
    float core = smoothstep(0.24, 0.18, r);
    float glow = exp(-r * 4.5);
    frag = vec4(mix(v_color, vec3(1.0, 0.97, 0.88), core), (core + glow * 0.85) * v_alpha);
  } else if (v_kind.x < 1.5) {
    // The Moon: a sphere lit from the Sun's side, as much of it as is lit tonight.
    if (r > 0.92) discard;
    vec2 q = p / 0.92;
    vec3 n = vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))));
    float s = sqrt(max(0.0, 1.0 - v_kind.w * v_kind.w));
    vec3 l = vec3(v_kind.y * s, v_kind.z * s, v_kind.w);
    float lit = smoothstep(-0.04, 0.06, dot(n, l));
    vec3 c = mix(vec3(0.07, 0.08, 0.1), v_color * (0.75 + 0.25 * n.z), lit);
    frag = vec4(c, smoothstep(1.0, 0.94, r / 0.92) * v_alpha);
  } else {
    frag = vec4(v_color, smoothstep(1.0, 0.35, r) * v_alpha);
  }
}`;

function compile(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const program = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`earth sky shader: ${gl.getShaderInfoLog(sh)}`);
    gl.attachShader(program, sh);
    gl.deleteShader(sh);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`earth sky link: ${gl.getProgramInfoLog(program)}`);
  return program;
}

const mat3Columns = (m: Mat3) => new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = (c: string): [number, number, number] => { const n = parseInt(c.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export function createEarthSkyLayer(id: string) {
  let gl: WebGL2RenderingContext | null = null;
  let map: MlMap | null = null;
  let programs: { star: WebGLProgram; line: WebGLProgram; mark: WebGLProgram } | null = null;
  const buffers: Record<'star' | 'line' | 'mark', WebGLBuffer | null> = { star: null, line: null, mark: null };
  // Own vertex arrays: attribute state set on whatever MapLibre left bound would corrupt its next draw.
  const vaos: Record<'star' | 'line' | 'mark', WebGLVertexArrayObject | null> = { star: null, line: null, mark: null };
  let catalog: StarCatalog | null = null;
  let starCount = 0, lineCount = 0;
  let starsDirty = false;
  let marks: SkyMark[] = [];
  let visible = true;
  let maxPoint = 64;
  const labelRoot = document.createElement('div');
  labelRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1;';
  const labels = new Map<string, HTMLDivElement>();

  function label(key: string, text: string, color: string, size: number): HTMLDivElement {
    let el = labels.get(key);
    if (!el) {
      el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;font:500 ${size}px var(--font-hud, monospace);letter-spacing:0.06em;color:${color};text-shadow:0 0 3px #000,0 0 6px #000;will-change:transform;`;
      labelRoot.appendChild(el);
      labels.set(key, el);
    }
    return el;
  }

  function hideLabels() {
    labels.forEach(el => { el.style.display = 'none'; });
  }

  function uploadStars() {
    if (!gl || !catalog) return;
    const named = new Set(Object.keys(catalog.names).map(Number));
    const data: number[] = [];
    catalog.stars.forEach(([ra, dec, mag, bv], i) => {
      const [r, g, b] = starColor(bv);
      const size = Math.max(1.1, Math.min(4.6, 3.6 - 0.62 * mag)) + (named.has(i) ? 0.4 : 0);
      data.push(...raDecVector(ra, dec), size, r, g, b, Math.max(0.18, Math.min(0.95, 0.95 - 0.13 * mag)));
    });
    starCount = catalog.stars.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.star);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const lines = catalog.asterisms.flatMap(([a, b]) => [...raDecVector(catalog!.stars[a][0], catalog!.stars[a][1]), ...raDecVector(catalog!.stars[b][0], catalog!.stars[b][1])]);
    lineCount = lines.length / 3;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.line);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);
    starsDirty = false;
  }

  function attrib(program: WebGLProgram, name: string, size: number, stride: number, offset: number) {
    const loc = gl!.getAttribLocation(program, name);
    if (loc < 0) return;
    gl!.enableVertexAttribArray(loc);
    gl!.vertexAttribPointer(loc, size, gl!.FLOAT, false, stride * 4, offset * 4);
  }

  function init(g: WebGL2RenderingContext) {
    programs = { star: compile(g, STAR_VERT, STAR_FRAG), line: compile(g, LINE_VERT, LINE_FRAG), mark: compile(g, MARK_VERT, MARK_FRAG) };
    buffers.star = g.createBuffer();
    buffers.line = g.createBuffer();
    buffers.mark = g.createBuffer();
    vaos.star = g.createVertexArray();
    g.bindVertexArray(vaos.star);
    g.bindBuffer(g.ARRAY_BUFFER, buffers.star);
    attrib(programs.star, 'a_dir', 3, 8, 0);
    attrib(programs.star, 'a_style', 4, 8, 3);
    attrib(programs.star, 'a_bright', 1, 8, 7);
    vaos.line = g.createVertexArray();
    g.bindVertexArray(vaos.line);
    g.bindBuffer(g.ARRAY_BUFFER, buffers.line);
    attrib(programs.line, 'a_dir', 3, 3, 0);
    vaos.mark = g.createVertexArray();
    g.bindVertexArray(vaos.mark);
    g.bindBuffer(g.ARRAY_BUFFER, buffers.mark);
    attrib(programs.mark, 'a_pos', 4, 12, 0);
    attrib(programs.mark, 'a_style', 4, 12, 4);
    attrib(programs.mark, 'a_kind', 4, 12, 8);
    g.bindVertexArray(null);
    maxPoint = (g.getParameter(g.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] || 64;
  }

  const layer: CustomLayerInterface = {
    id,
    type: 'custom',
    renderingMode: '2d',
    onAdd(m, context) {
      // GL objects are made on the first render: MapLibre re-syncs its cached
      // GL state after a custom layer renders, but not after onAdd.
      map = m;
      gl = context as WebGL2RenderingContext;
      m.getContainer().appendChild(labelRoot);
      starsDirty = true;
    },
    onRemove() {
      if (gl && programs) {
        Object.values(programs).forEach(p => gl!.deleteProgram(p));
        Object.values(buffers).forEach(b => b && gl!.deleteBuffer(b));
        Object.values(vaos).forEach(v => v && gl!.deleteVertexArray(v));
      }
      labelRoot.remove();
      programs = null;
      gl = null;
      map = null;
    },
    render(_gl: WebGL2RenderingContext | WebGLRenderingContext, args: CustomRenderMethodInput) {
      const proj = args.defaultProjectionData;
      const alpha = visible && map && proj && proj.projectionTransition > 0.98 ? 1 - smooth(FADE_FROM_ZOOM, FADE_TO_ZOOM, map.getZoom()) : 0;
      if (!gl || !map || !proj || alpha <= 0.01) { hideLabels(); return; }
      if (!programs) init(gl);
      if (!programs) return;
      if (starsDirty) uploadStars();
      const matrix = proj.mainMatrix;
      const now = Date.now();
      const jd = jdFromMs(now);
      const sky = j2000ToGlobe(jd);
      const ofDate = equatorialOfDateToGlobe(jd);
      const ratio = map.getPixelRatio();
      const cam = cameraPosition(matrix);
      if (!cam) { hideLabels(); return; }

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.STENCIL_TEST);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      if (lineCount) {
        gl.useProgram(programs.line);
        gl.uniformMatrix4fv(gl.getUniformLocation(programs.line, 'u_matrix'), false, matrix);
        gl.uniformMatrix3fv(gl.getUniformLocation(programs.line, 'u_sky'), false, mat3Columns(sky));
        gl.uniform1f(gl.getUniformLocation(programs.line, 'u_alpha'), alpha);
        gl.uniform3f(gl.getUniformLocation(programs.line, 'u_cam'), cam[0], cam[1], cam[2]);
        gl.bindVertexArray(vaos.line);
        gl.drawArrays(gl.LINES, 0, lineCount);
      }
      if (starCount) {
        gl.useProgram(programs.star);
        gl.uniformMatrix4fv(gl.getUniformLocation(programs.star, 'u_matrix'), false, matrix);
        gl.uniformMatrix3fv(gl.getUniformLocation(programs.star, 'u_sky'), false, mat3Columns(sky));
        gl.uniform1f(gl.getUniformLocation(programs.star, 'u_ratio'), ratio);
        gl.uniform1f(gl.getUniformLocation(programs.star, 'u_alpha'), alpha);
        gl.uniform3f(gl.getUniformLocation(programs.star, 'u_cam'), cam[0], cam[1], cam[2]);
        gl.bindVertexArray(vaos.star);
        gl.drawArrays(gl.POINTS, 0, starCount);
      }

      const canvas = map.getCanvas();
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const placed: { key: string; text: string; color: string; size: number; at: [number, number] }[] = [];

      // Marks are built per frame: there are a dozen, and the Moon's lighting depends on the view.
      const sun = marks.find(m => m.kind === 'sun');
      const sunDir = sun ? mul(ofDate, raDecVector(sun.ra, sun.dec)) : null;
      const data: number[] = [];
      for (const mk of marks) {
        const dir = mul(ofDate, raDecVector(mk.ra, mk.dec));
        const pos: [number, number, number, number] = Number.isFinite(mk.dist) ? [dir[0] * mk.dist, dir[1] * mk.dist, dir[2] * mk.dist, 1] : [...dir, 0];
        const kind = mk.kind === 'sun' ? 0 : mk.kind === 'moon' ? 1 : 2;
        const size = Math.min(maxPoint / ratio, mk.kind === 'sun' ? 64 : mk.kind === 'moon' ? 16 : 5);
        let light: [number, number, number] = [0, 0, 1];
        if (mk.kind === 'moon' && sunDir && mk.illum !== undefined) {
          // The Sun's direction across the Moon's disc on screen, from a nearby point toward it.
          const a = toScreen(matrix, pos, w, h);
          const b = toScreen(matrix, [pos[0] + sunDir[0] * 0.5, pos[1] + sunDir[1] * 0.5, pos[2] + sunDir[2] * 0.5, 1], w, h);
          if (a && b) {
            const dx = b[0] - a[0], dy = a[1] - b[1], n = Math.hypot(dx, dy) || 1;
            light = [dx / n, dy / n, 2 * mk.illum - 1];
          }
        }
        const [r, g, bl] = hex(mk.color);
        data.push(...pos, size, r, g, bl, kind, ...light);
        const at = toScreen(matrix, pos, w, h);
        const behind = hiddenByGlobe(cam, Number.isFinite(mk.dist) ? [pos[0] - cam[0], pos[1] - cam[1], pos[2] - cam[2]] : dir, Number.isFinite(mk.dist) ? Math.hypot(pos[0] - cam[0], pos[1] - cam[1], pos[2] - cam[2]) : Infinity);
        if (at && !behind) placed.push({ key: `b:${mk.name}`, text: mk.name, color: mk.color, size: 10, at: [at[0] + size / 2 + 3, at[1] - 5] });
      }
      if (data.length) {
        gl.useProgram(programs.mark);
        gl.uniformMatrix4fv(gl.getUniformLocation(programs.mark, 'u_matrix'), false, matrix);
        gl.uniform1f(gl.getUniformLocation(programs.mark, 'u_ratio'), ratio);
        gl.uniform1f(gl.getUniformLocation(programs.mark, 'u_alpha'), alpha);
        gl.uniform3f(gl.getUniformLocation(programs.mark, 'u_cam'), cam[0], cam[1], cam[2]);
        gl.bindVertexArray(vaos.mark);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.mark);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.POINTS, 0, data.length / 12);
      }
      gl.bindVertexArray(null);

      if (catalog) {
        for (const [i, name] of Object.entries(catalog.names)) {
          const [ra, dec, mag] = catalog.stars[Number(i)];
          if (mag > LABEL_MAG) continue;
          const dir = mul(sky, raDecVector(ra, dec));
          const at = toScreen(matrix, [...dir, 0], w, h);
          if (at && !hiddenByGlobe(cam, dir)) placed.push({ key: `s:${name}`, text: name, color: 'rgba(205,215,255,0.5)', size: 9, at: [at[0] + 5, at[1] - 4] });
        }
      }
      hideLabels();
      for (const p of placed) {
        if (p.at[0] < -40 || p.at[1] < -20 || p.at[0] > w + 40 || p.at[1] > h + 20) continue;
        const el = label(p.key, p.text, p.color, p.size);
        el.style.display = 'block';
        el.style.opacity = String(alpha);
        el.style.transform = `translate(${p.at[0].toFixed(1)}px, ${p.at[1].toFixed(1)}px)`;
      }
    },
  };

  return Object.assign(layer, {
    setCatalog(c: StarCatalog) { catalog = c; starsDirty = true; map?.triggerRepaint(); },
    setMarks(m: SkyMark[]) { marks = m; map?.triggerRepaint(); },
    setVisible(v: boolean) { visible = v; if (!v) hideLabels(); map?.triggerRepaint(); },
  });
}

export type EarthSkyLayer = ReturnType<typeof createEarthSkyLayer>;
