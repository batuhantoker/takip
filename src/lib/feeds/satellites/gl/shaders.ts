export const VERT = `
in vec2 a_corner;   // unit quad, -1..1 — one shared quad, drawn per instance
in vec3 a_pos;      // x, y = mercator [0..1]; z = display elevation (metres)
in vec3 a_color;
in float a_size;
uniform vec2 u_viewport;
uniform int u_selected;
uniform float u_hot;
uniform vec3 u_cam;
uniform float u_sky_fade;
out vec2 v_corner;
out vec3 v_color;
out float v_hot;
out float v_fade;
void main() {
  // A negative size is a satellite with nowhere to be drawn: outside the clip volume, so nothing is.
  if (a_size < 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec4 clip = projectTileFor3D(a_pos.xy, a_pos.z);
  v_fade = 1.0;
#ifdef GLOBE
  // Against the sky when the line of sight through it misses the globe (unit sphere, camera in the same units).
  vec3 at = projectToSphere(a_pos.xy, a_pos.xy) * (1.0 + a_pos.z / GLOBE_RADIUS);
  vec3 ray = normalize(at - u_cam);
  float b = dot(u_cam, ray);
  if (b * b - (dot(u_cam, u_cam) - 1.0) <= 0.0 || b > 0.0) v_fade = u_sky_fade;
#endif
  // Shrink with distance so a dense catalogue does not turn the globe into a
  // solid sheet of dots when zoomed out.
  float px = clamp(a_size * 260.0 / max(clip.w, 0.0001), 2.0, 14.0);
  // One satellite out of nineteen thousand is invisible unless it is told to
  // stand out; the selected one gets size and a ring.
  v_hot = gl_InstanceID == u_selected ? 1.0 : 0.0;
  px += v_hot * u_hot;
  // Expand the quad in clip space. Multiplying by clip.w cancels the
  // perspective divide, so the marker keeps a constant size in pixels.
  gl_Position = clip + vec4(a_corner * px / u_viewport * 2.0 * clip.w, 0.0, 0.0);
  v_corner = a_corner;
  v_color = a_color;
}`;

export const FRAG = `
precision mediump float;
in vec2 v_corner;
in vec3 v_color;
in float v_hot;
in float v_fade;
out vec4 fragColor;
void main() {
  // Round the marker off inside the quad; square satellites read as dead
  // pixels rather than objects.
  float r = length(v_corner);
  if (r > 1.0) discard;
  if (v_hot > 0.5) {
    // A bright ring rather than a bigger blob — a blob just looks like a
    // closer satellite, a ring reads as a selection.
    float ring = smoothstep(0.55, 0.75, r) * smoothstep(1.0, 0.85, r);
    vec3 c = mix(v_color, vec3(1.0), 0.55);
    fragColor = vec4(c, max(ring, smoothstep(0.45, 0.0, r)) * 0.95);
    return;
  }
  fragColor = vec4(v_color, smoothstep(1.0, 0.55, r) * 0.6 * v_fade);
}`;

/**
 * The picking pass. Same vertex maths as the visible pass — that is the whole
 * point: whatever the projection does to a satellite on screen, the pick
 * agrees, because it is the identical computation. Reimplementing the globe
 * projection on the CPU to hit-test would be a second source of truth, and it
 * would drift.
 *
 * The instance index is written straight out as a colour. gl_InstanceID means
 * no extra attribute is needed.
 */
export const PICK_VERT = `
in vec2 a_corner;
in vec3 a_pos;
in float a_size;
uniform vec2 u_viewport;
flat out vec3 v_id;
out vec2 v_corner;
void main() {
  if (a_size < 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec4 clip = projectTileFor3D(a_pos.xy, a_pos.z);
  // A little larger than the drawn marker: clicking is coarse, and a target
  // the exact size of a 3px dot is a target nobody can hit.
  float px = clamp(a_size * 260.0 / max(clip.w, 0.0001), 2.5, 16.0) + 4.0;
  gl_Position = clip + vec4(a_corner * px / u_viewport * 2.0 * clip.w, 0.0, 0.0);
  int id = gl_InstanceID + 1;   // 0 is reserved for 'nothing here'
  v_id = vec3(float(id & 255), float((id >> 8) & 255), float((id >> 16) & 255)) / 255.0;
  v_corner = a_corner;
}`;

export const PICK_FRAG = `
precision mediump float;
flat in vec3 v_id;
in vec2 v_corner;
out vec4 fragColor;
void main() {
  if (length(v_corner) > 1.0) discard;
  fragColor = vec4(v_id, 1.0);
}`;

/**
 * The orbit track of the selected satellite, drawn at altitude rather than
 * projected onto the ground. A ground track is a different object: it shows
 * where the satellite passes over, not where it is. Lifting the line to the
 * same elevation as the marker is what makes it read as an orbit around the
 * planet instead of a line drawn on it.
 */
export const ORBIT_VERT = `
in vec3 a_pos;
in vec3 a_other;    // the neighbouring track point this vertex's segment runs to
in float a_side;
uniform vec2 u_viewport;
uniform float u_width;
void main() {
  vec4 clip = projectTileFor3D(a_pos.xy, a_pos.z);
  vec4 other = projectTileFor3D(a_other.xy, a_other.z);
  // Widened across the line on screen, so the track keeps its width in pixels at any zoom.
  vec2 d = (other.xy / other.w - clip.xy / clip.w) * u_viewport;
  vec2 dir = length(d) > 0.0001 ? normalize(d) : vec2(1.0, 0.0);
  vec2 across = vec2(-dir.y, dir.x) * a_side;
  gl_Position = clip + vec4(across * u_width / u_viewport * clip.w, 0.0, 0.0);
}`;

export const ORBIT_FRAG = `
precision mediump float;
uniform vec3 u_color;
out vec4 fragColor;
void main() { fragColor = vec4(u_color, 0.85); }`;

export function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`satellite layer shader failed: ${log}`);
  }
  return sh;
}
