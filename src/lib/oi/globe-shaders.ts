/** Hidden behind the planet? Shared by every vertex shader here. */
const IN_SIGHT = `
float inSight(vec2 merc, float elevation) {
#ifdef GLOBE
  vec4 plane = u_projection_clipping_plane;
  if (plane.w > -1e-6 || u_projection_transition < 0.999) return 1.0;
  // The horizon plane is (unit normal toward the camera, -1 / camera distance): the camera, in Earth radii.
  vec3 cam = plane.xyz * (-1.0 / plane.w);
  vec3 p = projectToSphere(merc, merc) * (1.0 + (elevation + 2000.0) / GLOBE_RADIUS);
  vec3 ray = p - cam;
  float a = dot(ray, ray);
  float b = 2.0 * dot(cam, ray);
  float c = dot(cam, cam) - 1.0;
  float disc = b * b - 4.0 * a * c;
  if (disc <= 0.0) return 1.0;
  float t = (-b - sqrt(disc)) / (2.0 * a);
  return (t > 0.0 && t < 0.9995) ? 0.0 : 1.0;
#else
  return 1.0;
#endif
}`;

export const ARC_VERT = `
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_prev;
layout(location = 2) in vec3 a_next;
layout(location = 3) in vec2 a_meta;   // side, t along the arc
layout(location = 4) in vec3 a_style;  // tone, id, highlight
layout(location = 5) in vec3 a_info;   // strength, birth, kind
layout(location = 6) in float a_len;   // km
uniform vec2 u_viewport;
uniform float u_ratio;
uniform float u_lift;
uniform float u_now;
uniform float u_dim;
uniform float u_hover;
uniform float u_widen;
out float v_side;
out float v_t;
out float v_strength;
out float v_age;
out float v_kind;
out float v_tone;
out float v_id;
out float v_hl;
out float v_len;
out float v_vis;
${IN_SIGHT}
vec2 screen(vec4 c) { return c.xy / c.w * u_viewport * 0.5; }
void main() {
  float elevation = a_pos.z * u_lift;
  vec4 cur = projectTileFor3D(a_pos.xy, elevation);
  vec4 prv = projectTileFor3D(a_prev.xy, a_prev.z * u_lift);
  vec4 nxt = projectTileFor3D(a_next.xy, a_next.z * u_lift);
  vec2 d = screen(nxt) - screen(prv);
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  float kind = a_info.z;
  float hovered = abs(a_style.y - u_hover) < 0.5 ? 1.0 : 0.0;
  // Band width in pixels: room for a soft glow either side of the line.
  float width = (kind > 2.5 ? 6.0 : kind > 1.5 ? 8.0 : kind > 0.5 ? 6.0 : 7.0 + 5.0 * a_info.x);
  width *= 1.0 + 0.6 * max(a_style.z * u_dim, hovered);
  width = width * u_ratio + u_widen;
  // Multiplying by w cancels the perspective divide: constant width on screen.
  cur.xy += normal * a_meta.x * width / u_viewport * cur.w;
  gl_Position = cur;
  v_side = a_meta.x;
  v_t = a_meta.y;
  v_strength = a_info.x;
  v_age = u_now - a_info.y;
  v_kind = kind;
  v_tone = a_style.x;
  v_id = a_style.y;
  v_hl = max(a_style.z, hovered);
  v_len = a_len;
  v_vis = inSight(a_pos.xy, elevation);
}`;

export const ARC_FRAG = `
precision highp float;
in float v_side;
in float v_t;
in float v_strength;
in float v_age;
in float v_kind;
in float v_tone;
in float v_id;
in float v_hl;
in float v_len;
in float v_vis;
uniform vec3 u_support;
uniform vec3 u_oppose;
uniform vec3 u_neutral;
uniform float u_now;
uniform float u_motion; // 0 when the viewer asked for reduced motion
uniform float u_flow;   // 1 while the run is live: pulses travel, dashes march
uniform float u_dim;    // 1 while something is selected
out vec4 fragColor;

/** Soft-edged on/off along the arc: duty is the share that is on. */
float dashes(float s, float duty) {
  float f = fract(s);
  return smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(duty, duty + 0.06, f));
}

void main() {
  if (v_vis < 0.5 || v_age < 0.0) discard;
  // The arc draws itself from speaker to target.
  float reveal = u_motion > 0.5 ? clamp(v_age / 1.1, 0.0, 1.0) : 1.0;
  reveal = 1.0 - pow(1.0 - reveal, 3.0);
  if (v_t > reveal) discard;

#ifdef PICK
  float id = v_id + 1.0;
  fragColor = vec4(mod(id, 256.0) / 255.0, mod(floor(id / 256.0), 256.0) / 255.0, floor(id / 65536.0) / 255.0, 1.0);
#else
  float d = abs(v_side);
  float core = exp(-d * d * 18.0);
  float halo = exp(-d * d * 3.0) * 0.3;
  float head = reveal < 1.0 ? smoothstep(0.1, 0.0, reveal - v_t) * 1.4 : 0.0;

  // Colour says how things stand: violet aligned or agreeing, magenta opposed or disputing, indigo between.
  vec3 tone = v_tone < 0.5 ? u_support : v_tone < 1.5 ? u_oppose : u_neutral;
  // Evidence from the feeds is quieter, a pale wash of its tone.
  if (v_kind > 0.5 && v_kind < 1.5) tone = mix(tone, vec3(0.86, 0.83, 0.96), 0.35);
  // "Weighing an actor" marches toward the actor; every other arc is a solid line. Spacing is in km along the arc.
  float s = v_t * v_len;
  float pattern = v_kind > 2.5 ? mix(0.18, 1.0, dashes(s / 140.0 - u_now * 0.9 * u_flow * u_motion, 0.5)) : 1.0;

  float speed = v_kind > 1.5 ? 0.5 : 0.22;
  float phase = fract(v_t - u_now * speed + v_strength * 3.7);
  float pulse = u_flow * u_motion * smoothstep(0.9, 1.0, phase) * 1.2;

  float base = v_kind > 0.5 && v_kind < 1.5 ? 0.55 : 0.9;
  float flash = 1.0 + 1.2 * exp(-v_age * 1.4) * u_motion;
  // Interactions from earlier rounds settle back, never out.
  float settle = v_kind > 1.5 ? mix(1.0, 0.45, clamp((v_age - 30.0) / 40.0, 0.0, 1.0)) : 1.0;
  float ends = mix(0.35, 1.0, smoothstep(0.0, 0.05, v_t) * smoothstep(1.0, 0.95, v_t));
  // A selection lights what belongs to it and lets the rest recede.
  float focus = mix(1.0, mix(0.13, 1.35, v_hl), u_dim) * mix(1.0, 1.35, v_hl * (1.0 - u_dim));

  // The drawing tip glows along the line itself, not across the whole ribbon.
  float alpha = clamp(((core + halo) * pattern * base * (0.55 + 0.45 * v_strength) + head * (core + halo * 0.5) + pulse * core) * flash * settle * ends * focus, 0.0, 1.0);
  vec3 col = mix(tone, vec3(1.0), clamp(core * 0.3 + head * 0.5 + pulse * 0.6, 0.0, 1.0));
  fragColor = vec4(col * alpha, alpha);
#endif
}`;

export const PING_VERT = `
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_pos;
layout(location = 2) in vec4 a_ping;   // rgb, size in px
layout(location = 3) in vec3 a_time;   // start, period, once
uniform vec2 u_viewport;
uniform float u_ratio;
uniform float u_now;
uniform float u_motion;
out vec2 v_corner;
out vec3 v_color;
out float v_phase;
out float v_alive;
${IN_SIGHT}
void main() {
  vec4 c = projectTileFor3D(a_pos, 0.0);
  float px = a_ping.w * u_ratio;
  gl_Position = c + vec4(a_corner * px / u_viewport * 2.0 * c.w, 0.0, 0.0);
  float age = u_now - a_time.x;
  float ph = age / a_time.y;
  v_alive = (age < 0.0 || (a_time.z > 0.5 && ph > 1.0) || u_motion < 0.5 || inSight(a_pos, 0.0) < 0.5) ? 0.0 : 1.0;
  v_phase = fract(ph);
  v_corner = a_corner;
  v_color = a_ping.rgb;
}`;

export const PING_FRAG = `
precision mediump float;
in vec2 v_corner;
in vec3 v_color;
in float v_phase;
in float v_alive;
out vec4 fragColor;
void main() {
  if (v_alive < 0.5) discard;
  float r = length(v_corner);
  float ring = smoothstep(0.14, 0.0, abs(r - v_phase)) * (1.0 - v_phase);
  float a = ring * 0.8;
  if (a < 0.01) discard;
  fragColor = vec4(v_color * a, a);
}`;
