// TAKIP brand geometry: the globe-and-orbit mark and the TAKIP logotype.
// Source of truth for public/brand/*, the favicons and src/components/brand/geometry.generated.ts.

const f = (n) => +n.toFixed(2);
const rad = (d) => (d * Math.PI) / 180;

export const COLORS = {
  globe: '#F2F5FA',
  accent: '#2F80FF',
  tileTop: '#121826',
  tileBottom: '#070A11',
};

// ── Mark (512 box) ──

const C = { x: 256, y: 256 };
const R = 150;
const ORBIT = { a: 236, b: 84, rot: -20 };

const cr = Math.cos(rad(ORBIT.rot));
const sr = Math.sin(rad(ORBIT.rot));
const orbitPt = (t) => {
  const x = ORBIT.a * Math.cos(t), y = ORBIT.b * Math.sin(t);
  return { x: C.x + x * cr - y * sr, y: C.y + x * sr + y * cr };
};
// Travel runs in decreasing t: in front of the globe left to right, then round the back.
const orbitDir = (t) => {
  const dx = ORBIT.a * Math.sin(t), dy = -ORBIT.b * Math.cos(t);
  const x = dx * cr - dy * sr, y = dx * sr + dy * cr;
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
};
const orbitArc = (t0, t1) => {
  const p0 = orbitPt(t0), p1 = orbitPt(t1);
  const large = Math.abs(t0 - t1) > Math.PI ? 1 : 0;
  return `M${f(p0.x)} ${f(p0.y)}A${ORBIT.a} ${ORBIT.b} ${ORBIT.rot} ${large} 0 ${f(p1.x)} ${f(p1.y)}`;
};
const ellipse = (rx, ry) =>
  `M${f(C.x - rx)} ${C.y}A${f(rx)} ${ry} 0 1 0 ${f(C.x + rx)} ${C.y}A${f(rx)} ${ry} 0 1 0 ${f(C.x - rx)} ${C.y}`;

const VARIANTS = {
  // Full detail, for 48px and up.
  full: {
    grid: 8, outline: 12, orbit: 14, gap: 7,
    meridians: [0.42, 0.8], centralMeridian: true, parallels: [-0.74, -0.36, 0, 0.36, 0.74],
    tHead: 0.3, tTail: Math.PI + 0.35, tFadeEnd: 2.3,
    arrow: { len: 32, half: 23, back: 16, notch: 6, border: 6 },
    dots: [2.05, 1.05], dotR: 13, predicted: [0.3 - 0.32, -Math.PI + 0.62],
  },
  // Favicon sizes: fewer, heavier lines.
  small: {
    grid: 24, outline: 30, orbit: 32, gap: 10,
    meridians: [0.5], centralMeridian: false, parallels: [0],
    tHead: 0.5, tTail: Math.PI - 0.1, tFadeEnd: 2.0,
    arrow: { len: 44, half: 34, back: 22, notch: 8, border: 12 },
    dots: [], dotR: 0, predicted: null,
  },
};

export function mark(variant = 'full') {
  const v = VARIANTS[variant];
  const head = orbitPt(v.tHead), d = orbitDir(v.tHead), n = { x: -d.y, y: d.x };
  const at = (k, m) => `${f(head.x + d.x * k + n.x * m)} ${f(head.y + d.y * k + n.y * m)}`;
  const { len, half, back, notch } = v.arrow;

  let grid = '';
  if (v.centralMeridian) grid += `M${C.x} ${C.y - R}V${C.y + R}`;
  for (const m of v.meridians) grid += ellipse(R * m, R);
  for (const p of v.parallels) {
    const y = C.y + R * p, hw = R * Math.sqrt(1 - p * p);
    grid += `M${f(C.x - hw)} ${f(y)}H${f(C.x + hw)}`;
  }

  const tail = orbitPt(v.tTail), fadeEnd = orbitPt(v.tFadeEnd);
  const dots = v.dots.map((t) => { const p = orbitPt(t); return [f(p.x), f(p.y)]; });

  // Padded bounds of everything drawn, so the mark can sit in a tight viewBox.
  const pts = [];
  for (let t = 0; t < Math.PI * 2; t += 0.01) pts.push(orbitPt(t));
  for (const [k, m] of [[len, 0], [-back, half], [-back, -half]]) {
    pts.push({ x: head.x + d.x * k + n.x * m, y: head.y + d.y * k + n.y * m });
  }
  const pad = v.orbit / 2 + 4;
  const minX = Math.min(C.x - R, ...pts.map((p) => p.x)) - pad;
  const maxX = Math.max(C.x + R, ...pts.map((p) => p.x)) + pad;
  const minY = Math.min(C.y - R - v.outline / 2, ...pts.map((p) => p.y)) - pad;
  const maxY = Math.max(C.y + R + v.outline / 2, ...pts.map((p) => p.y)) + pad;

  return {
    globe: { cx: C.x, cy: C.y, r: R },
    stroke: { grid: v.grid, outline: v.outline, orbit: v.orbit, gap: v.gap, arrow: v.arrow.border },
    grid,
    front: orbitArc(v.tTail, v.tHead + 0.01),
    predicted: v.predicted ? orbitArc(v.predicted[0], v.predicted[1]) : null,
    arrow: `M${at(len, 0)}L${at(-back, half)}L${at(-notch, 0)}L${at(-back, -half)}Z`,
    dots,
    dotR: v.dotR,
    fade: { x1: f(tail.x), y1: f(tail.y), x2: f(fadeEnd.x), y2: f(fadeEnd.y) },
    box: [f(minX), f(minY), f(maxX - minX), f(maxY - minY)],
  };
}

// ── Logotype: cap height 100, origin top-left ──

const H = 100, S = 18, SH = 16; // stem, horizontal stroke

const poly = (pts) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
const rect = (x, y, w, h) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const bandWidth = (xTop, xBot) => S / Math.cos(Math.atan2(xBot - xTop, H));
// Stroke of width S along the line (xTop,0)-(xBot,H), cut flat at y0 and y1.
const band = (xTop, xBot, y0 = 0, y1 = H) => {
  const wh = bandWidth(xTop, xBot), xAt = (y) => xTop + ((xBot - xTop) * y) / H;
  return [[xAt(y0) - wh / 2, y0], [xAt(y0) + wh / 2, y0], [xAt(y1) + wh / 2, y1], [xAt(y1) - wh / 2, y1]];
};
// Keep the part of a convex polygon with x >= xMin.
const clipLeft = (pts, xMin) => {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ain = a[0] >= xMin, bin = b[0] >= xMin;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (xMin - a[0]) / (b[0] - a[0]);
      out.push([xMin, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
};

const LETTERS = {
  T: () => { const w = 80; return { w, d: rect(0, 0, w, SH) + rect(w / 2 - S / 2, 0, S, H) }; },
  A: () => {
    const w = 94;
    let x0 = w / 2 - 6;
    for (let i = 0; i < 20; i++) x0 = w / 2 - bandWidth(x0, 0) * 0.08;
    const xb = bandWidth(x0, 0) / 2;
    const yBar = 66, xl = x0 + ((xb - x0) * yBar) / H;
    return { w, d: poly(band(x0, xb)) + poly(band(w - x0, w - xb)) + rect(xl, yBar, w - 2 * xl, SH - 1) };
  },
  K: () => {
    const w = 82, yJoin = 62;
    const xTop = w - bandWidth(w, S) / 2;
    const slope = (xTop - S) / yJoin;
    const arm = clipLeft(band(xTop, xTop - slope * H, 0, yJoin + 12), S / 2);
    const yLeg = 42, xLeg = xTop - slope * yLeg;
    const xBot = w - bandWidth(xLeg, w) / 2;
    const legSlope = (xBot - xLeg) / (H - yLeg);
    const leg = band(xLeg - legSlope * yLeg, xBot, yLeg, H);
    return { w, d: rect(0, 0, S, H) + poly(arm) + poly(leg) };
  },
  I: () => ({ w: S, d: rect(0, 0, S, H) }),
  P: () => {
    const yb = 60, bx = 30, rxo = 32, ryo = yb / 2, rxi = rxo - S, ryi = ryo - SH;
    return {
      w: bx + rxo,
      d: rect(0, 0, S, H),
      ring: `M0 0H${bx}A${rxo} ${ryo} 0 0 1 ${bx} ${yb}H0Z` + `M${S} ${SH}V${yb - SH}H${bx}A${rxi} ${ryi} 0 0 0 ${bx} ${SH}Z`,
    };
  },
};

const translate = (d, dx) => d.replace(/([MLHA])([^MLHAVZ]*)/g, (_, cmd, args) => {
  const n = args.trim().split(/[ ,]+/).map(Number);
  if (cmd === 'H') return `H${f(n[0] + dx)}`;
  if (cmd === 'A') return `A${n[0]} ${n[1]} ${n[2]} ${n[3]} ${n[4]} ${f(n[5] + dx)} ${n[6]}`;
  return `${cmd}${f(n[0] + dx)} ${n[1]}`;
});

export function wordmark({ tracking = 30, kern = { TA: -20, AK: -2 } } = {}) {
  let x = 0, prev = null, d = '', ring = '';
  for (const ch of 'TAKIP') {
    if (prev) x += tracking + (kern[prev + ch] ?? 0);
    const L = LETTERS[ch]();
    d += translate(L.d, x);
    if (L.ring) ring += translate(L.ring, x);
    x += L.w;
    prev = ch;
  }
  // `ring` holds counters, so it needs evenodd; `d` is plain nonzero.
  return { width: f(x), height: H, d, ring };
}
