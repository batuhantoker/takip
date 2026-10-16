import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';
import { cameraPosition } from '@/lib/space/globe/sky-projection';
import { createSatelliteProgramCache } from './gl/programs';
import { movePacked, packOrbit, packVertices } from './gl/pack';
import { compile, FRAG, ORBIT_FRAG, ORBIT_VERT, PICK_FRAG, PICK_VERT, VERT } from './gl/shaders';
import { SAT_MAX_ZOOM, type SatPoint } from './points';

/**
 * TAKIP — satellites drawn at their real altitude
 *
 * Satellites were circle features pinned to the ground, so a 35,786 km GEO
 * bird and a 400 km ISS sat on the same surface as a traffic camera. The map
 * already runs MapLibre's globe projection, and the catalogue already carries
 * an altitude per satellite; nothing was lifting one off the other.
 *
 * MapLibre has no elevation property on circle or symbol layers. It does hand
 * custom layers a projection prelude, and in globe mode that prelude exposes
 *
 *     vec4 projectTileFor3D(vec2 posInTile, float elevation)
 *
 * which is what places geometry above the surface with the globe's own
 * curvature and camera. Verified against the running map before this was
 * written: the globe variant of the prelude does export it.
 *
 * Using MapLibre's prelude rather than our own matrix maths is what makes this
 * survive a projection change — the same shader compiles for mercator, where
 * `projectTileFor3D` is the flat-map equivalent, so the layer keeps working
 * when the operator presses 2D.
 */

/*
 * Zoomed in and tilted, the satellites standing against the sky would bury the
 * map's stars, so those fade to this as the zoom goes from SKY_FADE_FROM to
 * SKY_FADE_TO. Over the whole globe they are its halo, and stay.
 */
const SKY_FADE_MIN = 0.15;
const SKY_FADE_FROM = 3.5;
const SKY_FADE_TO = 5.5;

/**
 * A MapLibre custom layer drawing satellites as points at altitude.
 *
 * The shader is compiled lazily per projection variant: MapLibre changes the
 * prelude when the projection changes, and a program built against the globe
 * prelude draws nothing under mercator.
 */
export function createSatelliteLayer(id: string): CustomLayerInterface & {
  setPoints(points: SatPoint[]): void;
  /** Moves the last setPoints() array without rebuilding it: mercator x, y and altitude km per point. */
  setPositions(positions: Float32Array): void;
  setExaggeration(value: number): void;
  /** What displayElevation() is multiplied by when drawing, so a camera can aim at a satellite where it is drawn. */
  exaggeration(): number;
  /** Index into the last setPoints() array, or null if nothing is under (x, y). */
  /** The marker under a screen point, nearest first; `accept` can rule out ones the globe hides. */
  pick(x: number, y: number, accept?: (index: number) => boolean): number | null;
  /** Orbit track of the selected satellite; null clears it. */
  setOrbit(segments: { lng: number; lat: number; altKm: number }[][] | null, color?: number): void;
  /** Highlights one index from the last setPoints(); null clears it. */
  setSelected(index: number | null): void;
} {
  let gl: WebGL2RenderingContext | null = null;
  let map: MlMap | null = null;
  let program: WebGLProgram | null = null;
  let activeShader: CustomRenderMethodInput['shaderData'] | null = null;
  let buffer: WebGLBuffer | null = null;
  let quad: WebGLBuffer | null = null;
  let pickProgram: WebGLProgram | null = null;
  let pickFbo: WebGLFramebuffer | null = null;
  let pickTex: WebGLTexture | null = null;
  let pickDepth: WebGLRenderbuffer | null = null;
  let pickSize = { w: 0, h: 0 };
  // The projection uniforms are only handed to us during render(). A pick
  // happens on a click, between frames, so the last frame's values are kept
  // and reused — the camera has not moved since.
  let lastProjection: CustomRenderMethodInput['defaultProjectionData'] | null = null;
  let orbitProgram: WebGLProgram | null = null;
  let orbitBuffers: { buf: WebGLBuffer; count: number }[] = [];
  let orbitSegments: { lng: number; lat: number; altKm: number }[][] | null = null;
  let orbitColor = 0x00e5ff;
  let orbitDirty = false;
  let selected = -1;
  let vertices: Float32Array<ArrayBuffer> = new Float32Array(0);
  let count = 0;
  let exaggeration = 1;
  let points: SatPoint[] = [];
  let dirty = false;
  let moved: Float32Array | null = null;
  let movedDirty = false;

  const link = (prelude: string, define: string, vert: string, frag: string): WebGLProgram => {
    const vs = compile(gl!, gl!.VERTEX_SHADER, `#version 300 es\n${prelude}\n${define}\n${vert}`);
    const fs = compile(gl!, gl!.FRAGMENT_SHADER, `#version 300 es\n${frag}`);
    const pr = gl!.createProgram()!;
    gl!.attachShader(pr, vs);
    gl!.attachShader(pr, fs);
    gl!.linkProgram(pr);
    gl!.deleteShader(vs);
    gl!.deleteShader(fs);
    if (!gl!.getProgramParameter(pr, gl!.LINK_STATUS)) {
      const log = gl!.getProgramInfoLog(pr);
      gl!.deleteProgram(pr);
      throw new Error(`satellite layer link failed: ${log}`);
    }
    return pr;
  };

  const programs = createSatelliteProgramCache<WebGLProgram>((kind, prelude, define) => {
    if (kind === 'pick') return link(prelude, define, PICK_VERT, PICK_FRAG);
    if (kind === 'orbit') return link(prelude, define, ORBIT_VERT, ORBIT_FRAG);
    return link(prelude, define, VERT, FRAG);
  }, pr => gl?.deleteProgram(pr));

  /** Lazily sized colour+depth target for the pick pass. */
  const ensurePickTargets = (w: number, h: number) => {
    if (!gl || (pickSize.w === w && pickSize.h === h && pickFbo)) return;
    if (pickTex) gl.deleteTexture(pickTex);
    if (pickDepth) gl.deleteRenderbuffer(pickDepth);
    if (pickFbo) gl.deleteFramebuffer(pickFbo);
    pickTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, pickTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    pickDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, pickDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    pickFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, pickDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    pickSize = { w, h };
  };

  /** Binds the quad + per-instance attributes for whichever program is active. */
  const bindAttributes = (pr: WebGLProgram) => {
    const cornerLoc = gl!.getAttribLocation(pr, 'a_corner');
    gl!.bindBuffer(gl!.ARRAY_BUFFER, quad);
    gl!.enableVertexAttribArray(cornerLoc);
    gl!.vertexAttribPointer(cornerLoc, 2, gl!.FLOAT, false, 0, 0);
    gl!.vertexAttribDivisor(cornerLoc, 0);

    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    const STRIDE = 7 * 4;
    for (const [name, size, offset] of [['a_pos', 3, 0], ['a_color', 3, 12], ['a_size', 1, 24]] as const) {
      const loc = gl!.getAttribLocation(pr, name);
      if (loc < 0) continue;
      gl!.enableVertexAttribArray(loc);
      gl!.vertexAttribPointer(loc, size, gl!.FLOAT, false, STRIDE, offset);
      gl!.vertexAttribDivisor(loc, 1);
    }
    return cornerLoc;
  };

  /** Instancing divisors are global; leaving them set corrupts later layers. */
  const clearDivisors = (pr: WebGLProgram, cornerLoc: number) => {
    gl!.vertexAttribDivisor(cornerLoc, 0);
    for (const n of ['a_pos', 'a_color', 'a_size']) {
      const loc = gl!.getAttribLocation(pr, n);
      if (loc >= 0) gl!.vertexAttribDivisor(loc, 0);
    }
  };

  const setProjectionUniforms = (pr: WebGLProgram, proj: NonNullable<CustomRenderMethodInput['defaultProjectionData']>) => {
    const u = (name: string) => gl!.getUniformLocation(pr, name);
    gl!.uniformMatrix4fv(u('u_projection_matrix'), false, proj.mainMatrix);
    gl!.uniform4f(u('u_projection_tile_mercator_coords'),
      proj.tileMercatorCoords[0], proj.tileMercatorCoords[1],
      proj.tileMercatorCoords[2], proj.tileMercatorCoords[3]);
    gl!.uniform4f(u('u_projection_clipping_plane'),
      proj.clippingPlane[0], proj.clippingPlane[1],
      proj.clippingPlane[2], proj.clippingPlane[3]);
    gl!.uniform1f(u('u_projection_transition'), proj.projectionTransition);
    gl!.uniformMatrix4fv(u('u_projection_fallback_matrix'), false, proj.fallbackMatrix);
  };

  return {
    id,
    type: 'custom',
    // '3d' so MapLibre depth-tests it against the globe: a satellite behind
    // the Earth must be occluded by it, not drawn over the top.
    renderingMode: '3d',

    onAdd(m: MlMap, context: WebGL2RenderingContext) {
      map = m;
      gl = context;
      buffer = gl.createBuffer();
      // One unit quad, reused for every satellite via instancing.
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,
        -1,  1,  1, -1,   1, 1,
      ]), gl.STATIC_DRAW);
      dirty = true;
    },

    onRemove() {
      if (gl) {
        programs.clear();
        if (buffer) gl.deleteBuffer(buffer);
        if (quad) gl.deleteBuffer(quad);
        if (pickTex) gl.deleteTexture(pickTex);
        if (pickDepth) gl.deleteRenderbuffer(pickDepth);
        if (pickFbo) gl.deleteFramebuffer(pickFbo);
        for (const o of orbitBuffers) gl.deleteBuffer(o.buf);
      }
      program = null;
      activeShader = null;
      lastProjection = null;
      buffer = null;
      quad = null;
      pickProgram = null;
      pickTex = null;
      pickDepth = null;
      pickFbo = null;
      pickSize = { w: 0, h: 0 };
      orbitProgram = null;
      orbitBuffers = [];
      gl = null;
      map = null;
    },

    setPoints(next: SatPoint[]) {
      points = next;
      moved = null;
      dirty = true;
      map?.triggerRepaint();
    },

    setPositions(next: Float32Array) {
      moved = next;
      movedDirty = true;
      map?.triggerRepaint();
    },

    exaggeration: () => exaggeration,

    setExaggeration(value: number) {
      exaggeration = value;
      dirty = true;
      orbitDirty = true;
      map?.triggerRepaint();
    },

    setSelected(index: number | null) {
      selected = index ?? -1;
      map?.triggerRepaint();
    },

    setOrbit(segments, color) {
      orbitSegments = segments;
      if (color !== undefined) orbitColor = color;
      orbitDirty = true;
      map?.triggerRepaint();
    },

    /**
     * Renders the satellites into an offscreen buffer with each instance
     * coloured by its index, then reads back the pixels around (x, y).
     *
     * Coordinates are CSS pixels, as an event reports them; the draw buffer
     * may be larger on a scaled display, so they are converted first.
     */
    pick(x: number, y: number, accept?: (index: number) => boolean): number | null {
      if (!gl || !activeShader || !buffer || !lastProjection || count === 0) return null;
      try { pickProgram = programs.get(activeShader, 'pick'); }
      catch (error) { console.warn('[TAKIP] Satellite picking unavailable:', error); return null; }
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      ensurePickTargets(w, h);
      if (!pickFbo) return null;

      const ratio = w / (gl.canvas as HTMLCanvasElement).clientWidth;
      const px = Math.round(x * ratio);
      // GL's origin is bottom-left; a DOM event's is top-left.
      const py = Math.round(h - y * ratio);

      const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pickFbo);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.BLEND);
      // No globe in this buffer to occlude against, so depth testing here
      // would only let satellites hide each other. Nearest-to-cursor wins.
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(pickProgram);
      setProjectionUniforms(pickProgram, lastProjection);
      gl.uniform2f(gl.getUniformLocation(pickProgram, 'u_viewport'), w, h);
      const cornerLoc = bindAttributes(pickProgram);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      clearDivisors(pickProgram, cornerLoc);

      // Read a small box, not one pixel: a click is never exact, and a marker
      // a few pixels across is otherwise unhittable.
      const R = 7;
      const x0 = Math.max(0, px - R), y0 = Math.max(0, py - R);
      const bw = Math.min(w - x0, R * 2 + 1), bh = Math.min(h - y0, R * 2 + 1);
      let best: number | null = null;
      if (bw > 0 && bh > 0) {
        const buf = new Uint8Array(bw * bh * 4);
        gl.readPixels(x0, y0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        // Nearest pixel per marker, then the nearest marker the caller accepts.
        const near = new Map<number, number>();
        for (let iy = 0; iy < bh; iy++) {
          for (let ix = 0; ix < bw; ix++) {
            const o = (iy * bw + ix) * 4;
            const id = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
            if (id === 0) continue;
            const dx = x0 + ix - px, dy = y0 + iy - py;
            const d = dx * dx + dy * dy;
            if (d < (near.get(id - 1) ?? Infinity)) near.set(id - 1, d);
          }
        }
        for (const [index] of [...near].sort((a, b) => a[1] - b[1])) {
          if (index >= 0 && index < count && (!accept || accept(index))) { best = index; break; }
        }
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
      gl.viewport(0, 0, w, h);
      gl.enable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      return best !== null && best >= 0 && best < count ? best : null;
    },
    render(_context: WebGL2RenderingContext | WebGLRenderingContext, args: CustomRenderMethodInput) {
      if (!gl || !buffer) return;
      // An inactive satellite layer must not compile three GPU programs on
      // startup or whenever the map switches between globe and flat views.
      if (!points.length) { count = 0; lastProjection = null; return; }
      /* Zoomed past the ceiling the layer draws nothing, and clearing the
         projection with it makes pick() answer null as well — so the click
         goes to whatever is actually on the ground there.

         `count` is left alone. It is how many satellites sit in the GPU
         buffer, and it is only set again when setPoints() marks the buffer
         dirty — so zeroing it here meant that after zooming in and back out
         the layer drew nothing until it was switched off and on again. */
      if (map && map.getZoom() > SAT_MAX_ZOOM) { lastProjection = null; return; }
      const shader = args?.shaderData;
      if (!shader?.vertexShaderPrelude) return;

      try {
        program = programs.get(shader, 'marker');
        orbitProgram = orbitSegments?.length ? programs.get(shader, 'orbit') : null;
        activeShader = shader;
      } catch (err) {
        console.error('[TAKIP] satellite layer:', err instanceof Error ? err.message : err);
        return;
      }
      if (!program) return;

      if (dirty || movedDirty) {
        if (dirty) vertices = packVertices(points, exaggeration);
        // A repack starts from where setPoints() put them, so the latest move goes back on top.
        if (moved && moved.length === points.length * 3) movePacked(vertices, moved, exaggeration);
        count = points.length;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        dirty = false;
        movedDirty = false;
      }
      if (count === 0) return;

      gl.useProgram(program);

      // MapLibre's prelude declares the projection uniforms but does not bind
      // them for a custom layer's own program — `defaultProjectionData` is
      // where the values come from, and every one has to be set. Without them
      // projectTile() reads zeroed uniforms and every vertex lands off-screen:
      // the draw succeeds, GL reports no error, and nothing appears.
      const proj = args.defaultProjectionData;
      lastProjection = proj ?? lastProjection;
      if (proj) setProjectionUniforms(program, proj);

      // The track first, so the marker draws over its own line.
      if (orbitDirty && orbitProgram) {
        for (const o of orbitBuffers) gl.deleteBuffer(o.buf);
        orbitBuffers = (orbitSegments ?? []).filter(seg => seg.length > 1).map(seg => {
          const data = packOrbit(seg, exaggeration);
          const buf = gl!.createBuffer()!;
          gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
          gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.STATIC_DRAW);
          return { buf, count: seg.length };
        });
        orbitDirty = false;
      }
      if (orbitProgram && orbitBuffers.length && proj) {
        gl.useProgram(orbitProgram);
        setProjectionUniforms(orbitProgram, proj);
        gl.uniform3f(gl.getUniformLocation(orbitProgram, 'u_color'),
          ((orbitColor >> 16) & 0xff) / 255, ((orbitColor >> 8) & 0xff) / 255, (orbitColor & 0xff) / 255);
        const loc = gl.getAttribLocation(orbitProgram, 'a_pos');
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        for (const o of orbitBuffers) {
          gl.bindBuffer(gl.ARRAY_BUFFER, o.buf);
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
          gl.vertexAttribDivisor(loc, 0);
          gl.drawArrays(gl.LINE_STRIP, 0, o.count);
        }
        gl.depthMask(true);
        gl.useProgram(program);
        setProjectionUniforms(program, proj);
      }

      const cornerLoc = bindAttributes(program);
      gl.uniform2f(gl.getUniformLocation(program, 'u_viewport'), gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1i(gl.getUniformLocation(program, 'u_selected'), selected);
      const cam = proj ? cameraPosition(proj.mainMatrix) : null;
      if (cam) gl.uniform3f(gl.getUniformLocation(program, 'u_cam'), cam[0], cam[1], cam[2]);
      const t = map ? Math.min(1, Math.max(0, (map.getZoom() - SKY_FADE_FROM) / (SKY_FADE_TO - SKY_FADE_FROM))) : 0;
      gl.uniform1f(gl.getUniformLocation(program, 'u_sky_fade'), cam ? 1 - (1 - SKY_FADE_MIN) * t * t * (3 - 2 * t) : 1);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      // Depth-tested against the globe so the far side occludes, but not
      // depth-written: satellites should not occlude each other into a mess.
      gl.depthMask(false);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      gl.depthMask(true);
      clearDivisors(program, cornerLoc);
    },
  };
}
