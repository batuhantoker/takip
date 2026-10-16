import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';
import { ARC_STRIDE, packArcs, rgb, type ArcSpec } from './arcs';
import { DEFAULT_TONES } from './colors';
import { ARC_FRAG, ARC_VERT, PING_FRAG, PING_VERT } from './shaders';

export const AI_ARCS = 'ai-arcs';

export interface Ping { pos: [number, number]; color: [number, number, number]; size: number; start: number; period: number; once: boolean }

export const clock = () => performance.now() / 1000;

type Programs = { arc: WebGLProgram; pick: WebGLProgram; ping: WebGLProgram };

export function createArcLayer(): CustomLayerInterface & {
  setArcs(arcs: ArcSpec[], dim: boolean): void;
  setPings(pings: Ping[]): void;
  setLive(live: boolean): void;
  setTones(tones: [number, number, number][]): void;
  setHover(id: number): void;
  pick(x: number, y: number): number | null;
} {
  let gl: WebGL2RenderingContext | null = null;
  let map: MlMap | null = null;
  const programs = new Map<string, Programs>();
  let arcs: ArcSpec[] = [];
  let pings: Ping[] = [];
  let arcBuf: { vao: WebGLVertexArrayObject; vbo: WebGLBuffer; ibo: WebGLBuffer; count: number } | null = null;
  let pingBuf: { vao: WebGLVertexArrayObject; quad: WebGLBuffer; inst: WebGLBuffer; count: number } | null = null;
  let arcsDirty = false;
  let pingsDirty = false;
  let live = false;
  let dim = false;
  let hover = -1;
  let tones: [number, number, number][] = [DEFAULT_TONES.support, DEFAULT_TONES.oppose, DEFAULT_TONES.neutral].map(rgb);
  let lastBirth = 0;
  // A pick happens on a pointer event, between frames: it reuses the last frame's projection and shaders.
  let lastProjection: CustomRenderMethodInput['defaultProjectionData'] | null = null;
  let lastShader: CustomRenderMethodInput['shaderData'] | null = null;
  let pickTarget: { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number } | null = null;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const compile = (type: number, src: string) => {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      const log = gl!.getShaderInfoLog(s);
      gl!.deleteShader(s);
      throw new Error(`AI layer shader failed: ${log}`);
    }
    return s;
  };
  const link = (vertSrc: string, fragSrc: string) => {
    const p = gl!.createProgram()!;
    const vs = compile(gl!.VERTEX_SHADER, vertSrc);
    const fs = compile(gl!.FRAGMENT_SHADER, fragSrc);
    gl!.attachShader(p, vs);
    gl!.attachShader(p, fs);
    gl!.linkProgram(p);
    gl!.deleteShader(vs);
    gl!.deleteShader(fs);
    if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) {
      const log = gl!.getProgramInfoLog(p);
      gl!.deleteProgram(p);
      throw new Error(`AI layer link failed: ${log}`);
    }
    return p;
  };
  /** One set of programs per projection variant: the prelude changes with the projection. */
  const programsFor = (shader: CustomRenderMethodInput['shaderData']): Programs => {
    const key = `${shader.variantName}\0${shader.define}`;
    let set = programs.get(key);
    if (!set) {
      const head = `#version 300 es\n${shader.vertexShaderPrelude}\n${shader.define}\n`;
      set = {
        arc: link(head + ARC_VERT, `#version 300 es\n${ARC_FRAG}`),
        pick: link(head + ARC_VERT, `#version 300 es\n#define PICK\n${ARC_FRAG}`),
        ping: link(head + PING_VERT, `#version 300 es\n${PING_FRAG}`),
      };
      programs.set(key, set);
    }
    return set;
  };

  // Attribute slots are fixed in the shaders (layout locations), so one VAO serves the drawing and the picking programs.
  const attrib = (loc: number, size: number, stride: number, offset: number, divisor = 0) => {
    gl!.enableVertexAttribArray(loc);
    gl!.vertexAttribPointer(loc, size, gl!.FLOAT, false, stride, offset);
    gl!.vertexAttribDivisor(loc, divisor);
  };

  const freeArcs = () => {
    if (!gl || !arcBuf) return;
    gl.deleteVertexArray(arcBuf.vao); gl.deleteBuffer(arcBuf.vbo); gl.deleteBuffer(arcBuf.ibo);
    arcBuf = null;
  };
  const freePings = () => {
    if (!gl || !pingBuf) return;
    gl.deleteVertexArray(pingBuf.vao); gl.deleteBuffer(pingBuf.quad); gl.deleteBuffer(pingBuf.inst);
    pingBuf = null;
  };

  const buildArcs = () => {
    const g = gl!;
    freeArcs();
    if (!arcs.length) return;
    const { vertices, indices } = packArcs(arcs);
    const vao = g.createVertexArray()!;
    g.bindVertexArray(vao);
    const vbo = g.createBuffer()!;
    g.bindBuffer(g.ARRAY_BUFFER, vbo);
    g.bufferData(g.ARRAY_BUFFER, vertices, g.STATIC_DRAW);
    const S = ARC_STRIDE * 4;
    attrib(0, 3, S, 0);
    attrib(1, 3, S, 12);
    attrib(2, 3, S, 24);
    attrib(3, 2, S, 36);
    attrib(4, 3, S, 44);
    attrib(5, 3, S, 56);
    attrib(6, 1, S, 68);
    const ibo = g.createBuffer()!;
    g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, ibo);
    g.bufferData(g.ELEMENT_ARRAY_BUFFER, indices, g.STATIC_DRAW);
    g.bindVertexArray(null);
    arcBuf = { vao, vbo, ibo, count: indices.length };
  };

  const buildPings = () => {
    const g = gl!;
    freePings();
    if (!pings.length) return;
    const vao = g.createVertexArray()!;
    g.bindVertexArray(vao);
    const quad = g.createBuffer()!;
    g.bindBuffer(g.ARRAY_BUFFER, quad);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), g.STATIC_DRAW);
    attrib(0, 2, 8, 0);
    const data = new Float32Array(pings.length * 9);
    pings.forEach((p, i) => data.set([p.pos[0], p.pos[1], ...p.color, p.size, p.start, p.period, p.once ? 1 : 0], i * 9));
    const inst = g.createBuffer()!;
    g.bindBuffer(g.ARRAY_BUFFER, inst);
    g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW);
    attrib(1, 2, 36, 0, 1);
    attrib(2, 4, 36, 8, 1);
    attrib(3, 3, 36, 24, 1);
    g.bindVertexArray(null);
    pingBuf = { vao, quad, inst, count: pings.length };
  };

  const setProjection = (program: WebGLProgram, proj: NonNullable<CustomRenderMethodInput['defaultProjectionData']>) => {
    const u = (n: string) => gl!.getUniformLocation(program, n);
    gl!.uniformMatrix4fv(u('u_projection_matrix'), false, proj.mainMatrix as Float32List);
    gl!.uniform4fv(u('u_projection_tile_mercator_coords'), proj.tileMercatorCoords as Float32List);
    gl!.uniform4fv(u('u_projection_clipping_plane'), proj.clippingPlane as Float32List);
    gl!.uniform1f(u('u_projection_transition'), proj.projectionTransition);
    gl!.uniformMatrix4fv(u('u_projection_fallback_matrix'), false, proj.fallbackMatrix as Float32List);
  };

  /** Arcs a thousand kilometres high mean nothing over a city: they settle as the view closes in. */
  const liftFor = (zoom: number) => (zoom <= 3.5 ? 1 : Math.max(0.12, 1 - (zoom - 3.5) * 0.22));

  const arcUniforms = (program: WebGLProgram, proj: NonNullable<CustomRenderMethodInput['defaultProjectionData']>, now: number, widen: number) => {
    const g = gl!;
    g.useProgram(program);
    setProjection(program, proj);
    const u = (n: string) => g.getUniformLocation(program, n);
    g.uniform2f(u('u_viewport'), g.drawingBufferWidth, g.drawingBufferHeight);
    g.uniform1f(u('u_ratio'), window.devicePixelRatio || 1);
    g.uniform1f(u('u_lift'), liftFor(map!.getZoom()));
    g.uniform1f(u('u_now'), now);
    g.uniform1f(u('u_motion'), reduced ? 0 : 1);
    g.uniform1f(u('u_flow'), live ? 1 : 0);
    g.uniform1f(u('u_dim'), dim ? 1 : 0);
    g.uniform1f(u('u_hover'), hover);
    g.uniform1f(u('u_widen'), widen);
    g.uniform3f(u('u_support'), ...tones[0]);
    g.uniform3f(u('u_oppose'), ...tones[1]);
    g.uniform3f(u('u_neutral'), ...tones[2]);
  };

  return {
    id: AI_ARCS,
    type: 'custom',
    renderingMode: '3d',

    setArcs(next, dimOthers) {
      arcs = next;
      dim = dimOthers;
      arcsDirty = true;
      lastBirth = next.reduce((m, a) => Math.max(m, a.birth), 0);
      map?.triggerRepaint();
    },
    setPings(next) { pings = next; pingsDirty = true; map?.triggerRepaint(); },
    setLive(v) { live = v; map?.triggerRepaint(); },
    setTones(t) { tones = t; map?.triggerRepaint(); },
    setHover(id) { if (id !== hover) { hover = id; map?.triggerRepaint(); } },

    pick(x, y) {
      if (!gl || !map || !arcBuf || !lastProjection || !lastShader) return null;
      const g = gl;
      let set: Programs;
      try { set = programsFor(lastShader); } catch { return null; }
      const w = g.drawingBufferWidth, h = g.drawingBufferHeight;
      if (!pickTarget || pickTarget.w !== w || pickTarget.h !== h) {
        if (pickTarget) { g.deleteFramebuffer(pickTarget.fbo); g.deleteTexture(pickTarget.tex); }
        const tex = g.createTexture()!;
        g.bindTexture(g.TEXTURE_2D, tex);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
        const fbo = g.createFramebuffer()!;
        g.bindFramebuffer(g.FRAMEBUFFER, fbo);
        g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
        pickTarget = { fbo, tex, w, h };
      }
      // Everything changed here is put back, so MapLibre's own view of the GL state stays true.
      const saved = {
        fbo: g.getParameter(g.FRAMEBUFFER_BINDING),
        program: g.getParameter(g.CURRENT_PROGRAM),
        vao: g.getParameter(g.VERTEX_ARRAY_BINDING),
        viewport: g.getParameter(g.VIEWPORT) as Int32Array,
        clear: g.getParameter(g.COLOR_CLEAR_VALUE) as Float32Array,
        blend: g.isEnabled(g.BLEND),
        depth: g.isEnabled(g.DEPTH_TEST),
        texture: g.getParameter(g.TEXTURE_BINDING_2D),
      };
      g.bindFramebuffer(g.FRAMEBUFFER, pickTarget.fbo);
      g.viewport(0, 0, w, h);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.disable(g.BLEND);
      g.disable(g.DEPTH_TEST);
      const ratio = w / (g.canvas as HTMLCanvasElement).clientWidth;
      arcUniforms(set.pick, lastProjection, clock(), 8 * ratio);
      g.bindVertexArray(arcBuf.vao);
      g.drawElements(g.TRIANGLES, arcBuf.count, g.UNSIGNED_INT, 0);

      // A small box, nearest hit to the cursor wins: a line a few pixels wide is otherwise hard to hit.
      const px = Math.round(x * ratio);
      const py = Math.round(h - y * ratio);
      const R = Math.round(6 * ratio);
      const x0 = Math.max(0, px - R), y0 = Math.max(0, py - R);
      const bw = Math.min(w - x0, R * 2 + 1), bh = Math.min(h - y0, R * 2 + 1);
      let best: number | null = null;
      if (bw > 0 && bh > 0) {
        const buf = new Uint8Array(bw * bh * 4);
        g.readPixels(x0, y0, bw, bh, g.RGBA, g.UNSIGNED_BYTE, buf);
        let bestDist = Infinity;
        for (let iy = 0; iy < bh; iy++) {
          for (let ix = 0; ix < bw; ix++) {
            const o = (iy * bw + ix) * 4;
            const id = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
            if (!id) continue;
            const dist = (x0 + ix - px) ** 2 + (y0 + iy - py) ** 2;
            if (dist < bestDist) { bestDist = dist; best = id - 1; }
          }
        }
      }

      g.bindFramebuffer(g.FRAMEBUFFER, saved.fbo);
      g.viewport(saved.viewport[0], saved.viewport[1], saved.viewport[2], saved.viewport[3]);
      g.clearColor(saved.clear[0], saved.clear[1], saved.clear[2], saved.clear[3]);
      if (saved.blend) g.enable(g.BLEND);
      if (saved.depth) g.enable(g.DEPTH_TEST);
      g.useProgram(saved.program);
      g.bindVertexArray(saved.vao);
      g.bindTexture(g.TEXTURE_2D, saved.texture);
      return best !== null && best < arcs.length ? best : null;
    },

    onAdd(m, context) {
      map = m;
      gl = context as WebGL2RenderingContext;
      arcsDirty = pingsDirty = true;
    },

    onRemove() {
      if (gl) {
        freeArcs();
        freePings();
        if (pickTarget) { gl.deleteFramebuffer(pickTarget.fbo); gl.deleteTexture(pickTarget.tex); }
        for (const p of programs.values()) { gl.deleteProgram(p.arc); gl.deleteProgram(p.pick); gl.deleteProgram(p.ping); }
      }
      programs.clear();
      pickTarget = null;
      lastProjection = null;
      lastShader = null;
      gl = null;
      map = null;
    },

    render(_ctx, args) {
      if (!gl || !map) return;
      const proj = args.defaultProjectionData;
      if (!proj || !args.shaderData?.vertexShaderPrelude) return;
      let set: Programs;
      try { set = programsFor(args.shaderData); }
      catch (err) { console.error('[TAKIP] AI layer:', err instanceof Error ? err.message : err); return; }
      lastProjection = proj;
      lastShader = args.shaderData;
      if (arcsDirty) { buildArcs(); arcsDirty = false; }
      if (pingsDirty) { buildPings(); pingsDirty = false; }
      if (!arcBuf && !pingBuf) return;

      const now = clock();
      const g = gl;
      // Occlusion is computed per vertex against the planet, so the depth buffer is not needed (and near the
      // surface it would only flicker).
      g.disable(g.DEPTH_TEST);
      g.depthMask(false);
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);

      if (arcBuf) {
        arcUniforms(set.arc, proj, now, 0);
        g.bindVertexArray(arcBuf.vao);
        g.drawElements(g.TRIANGLES, arcBuf.count, g.UNSIGNED_INT, 0);
      }
      if (pingBuf) {
        const p = set.ping;
        g.useProgram(p);
        setProjection(p, proj);
        const u = (n: string) => g.getUniformLocation(p, n);
        g.uniform2f(u('u_viewport'), g.drawingBufferWidth, g.drawingBufferHeight);
        g.uniform1f(u('u_ratio'), window.devicePixelRatio || 1);
        g.uniform1f(u('u_now'), now);
        g.uniform1f(u('u_motion'), reduced ? 0 : 1);
        g.bindVertexArray(pingBuf.vao);
        g.drawArraysInstanced(g.TRIANGLES, 0, 6, pingBuf.count);
      }
      g.bindVertexArray(null);

      // Keep animating while the run is live and while arcs are still drawing in.
      const pending = now < lastBirth + 2.5 || pings.some(pg => (!pg.once ? live : now < pg.start + pg.period));
      if (!reduced && (live || pending)) map.triggerRepaint();
    },
  };
}
