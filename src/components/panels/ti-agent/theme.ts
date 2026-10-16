/**
 * TI's colours and number helpers.
 *
 * Gold is TI's own emphasis: the prediction, what is live, the line that
 * matters. Everything else uses the app's neutral ink. The arcs keep the
 * colours set in the Style Studio, and only appear where TI draws or explains
 * them (the legend, the graph's lines).
 */
import type { Frame, Link } from '@/lib/ai/types';

/** CSS colours for SVG and inline styles; markup uses the token classes (text-gold, bg-surface-2…). */
export const T = {
  gold: 'var(--gold)',
  /** Gold, quieter: second series beside the prediction. */
  goldDim: 'color-mix(in srgb, var(--gold) 55%, var(--ink-3))',
  ink1: 'var(--ink-1)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  ink4: 'var(--ink-4)',
  line: 'var(--line)',
  lineStrong: 'var(--line-strong)',
  surface: 'var(--surface-1)',
  raised: 'var(--surface-2)',
  red: 'var(--red)',
  green: 'var(--green)',
  blue: 'var(--blue)',
  /** The arcs' three colours, from the Style Studio. */
  support: 'var(--map-ai-support)',
  oppose: 'var(--map-ai-oppose)',
  neutral: 'var(--map-ai-neutral)',
};

/**
 * What a prediction is weighed against. Shape tells them apart on the charts;
 * colour backs it up: the prediction in gold, the simulation in a quieter
 * gold, the crowd in blue, the statistical baseline in ink.
 */
export const ANCHOR = { baseline: T.ink2, market: T.blue, simulation: T.goldDim, prediction: T.gold } as const;

/** Each simulated world's colour on a chart, the first (the likeliest course) in gold. */
export const WORLD_COLORS = [T.gold, T.ink1, T.blue, 'var(--violet)', T.ink3];

/** The arcs' colour for a line's tone: for drawing the arcs and the graph's lines, and the legend that explains them. */
export const toneColor = (tone: Link['tone']) => (tone === 'support' ? T.support : tone === 'oppose' ? T.oppose : T.neutral);

export const TONE_WORD: Record<Link['tone'], string> = { support: 'Aligned', oppose: 'Opposed', neutral: 'Between' };

/** Which way something pushes the question, in its own terms: "yes", "higher", or the outcome it favours. */
export function leanWord(frame: Frame | null, push: 'yes' | 'no', favors = ''): string {
  if (frame?.kind === 'choice') return favors || (push === 'yes' ? 'for' : 'against');
  if (frame?.kind === 'number') return push === 'yes' ? 'higher' : 'lower';
  return push === 'yes' ? 'yes' : 'no';
}

/** "YES" or "52% YES" from the engine, as a person would write it. */
export const sentence = (s: string) => (/^[A-Z]{2,4}$/.test(s) ? s[0] + s.slice(1).toLowerCase() : s.replace(/\b(YES|NO)\b/g, w => w.toLowerCase()));

export const pct = (p: number | null | undefined) => (p === null || p === undefined || !Number.isFinite(p) ? '—' : `${Math.round(p * 100)}%`);
export const initials = (name: string) => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
export const shortName = (name: string) => name.replace(' (Alibaba Cloud)', '').replace(' (scripted, dev only)', '');
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export const KIND_LABEL: Record<Frame['kind'], string> = { binary: 'Yes or no', choice: 'Which outcome', number: 'How much' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-12-17" as "17 Dec 2026", the way the period headers write dates; anything else as it came. */
export function fmtDate(d: string): string {
  const m = d.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  if (!m || !month) return d;
  return m[3] ? `${Number(m[3])} ${month} ${m[1]}` : `${month} ${m[1]}`;
}

/** "4 min ago", "2 h ago", "3 d ago". */
export function ago(iso: string | number): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** "0.4 s", "38 s", "2 min 5 s": how long something took, the way the status bar writes units. */
export function took(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  const s = Math.round(ms / 1000);
  return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`;
}

/** The same as a figure and its unit, for a Stat: "38" "s", or "2:05" "min". */
export function tookParts(ms: number): { value: string; unit: string } {
  if (!Number.isFinite(ms) || ms < 0) return { value: '—', unit: '' };
  if (ms < 60_000) return { value: ms < 10_000 ? (ms / 1000).toFixed(1) : `${Math.round(ms / 1000)}`, unit: 's' };
  const s = Math.round(ms / 1000);
  return { value: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, unit: 'min' };
}

/** A window around some values, at least `min` wide, so small moves still read as moves. */
export function fit(vals: number[], min: number): [number, number] {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const half = Math.max(min, (hi - lo) * 1.2) / 2;
  return [(lo + hi) / 2 - half, (lo + hi) / 2 + half];
}

/** A smooth line through points, for trajectories and sparklines. */
export function smooth(points: [number, number][]): string {
  if (points.length < 2) return points.length ? `M${points[0][0]},${points[0][1]}` : '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
  }
  return d;
}
