import { Prec } from '@takip/core/time';
import { pop, type PopRow } from '@/lib/map/popups/kit';

/* Popups for the curated history layer (replay mode): wars, battles, claims, attacks, heritage. */

/** One calm categorical colour per family, from the design tokens; the History panel's toggles read these too. */
export const HISTORY_FAMILIES: Record<string, { color: string; label: string; magnitude?: string }> = {
  conflict: { color: '#E5534B', label: 'Conflict', magnitude: 'Deaths' },
  terror: { color: '#D98A4E', label: 'Attack', magnitude: 'Killed' },
  territorial: { color: '#9B8AFB', label: 'Territory' },
  heritage: { color: '#5B9CF5', label: 'Heritage' },
  hazard: { color: '#D8C26A', label: 'Natural hazards', magnitude: 'Magnitude' },
  politics: { color: '#D99AB4', label: 'Treaties and coups' },
  nuclear: { color: '#A9C46A', label: 'Nuclear explosions', magnitude: 'Yield (kt)' },
};
export const HISTORY_FALLBACK_COLOR = '#7F8B96';

const KINDS: Record<string, string> = {
  war: 'War',
  'war.interstate': 'Interstate war',
  'war.civil': 'Civil war',
  'war.world': 'World war',
  'war.independence': 'War of independence',
  'conflict.armed': 'Armed conflict',
  battle: 'Battle',
  'claim.territorial': 'Territorial claim',
  'change.territorial': 'Territorial change',
  'attack.terror': 'Terrorist attack',
  'status.in_danger': 'World Heritage in danger',
  'hazard.quake': 'Earthquake',
  'battle.siege': 'Siege',
  'hazard.tsunami': 'Tsunami',
  'hazard.volcano': 'Volcanic eruption',
  'politics.treaty': 'Treaty',
  'politics.coup': 'Coup',
  'nuclear.test': 'Nuclear test',
  'nuclear.combat': 'Nuclear attack',
};

const PLACEMENT: Record<number, string> = {
  3: 'Placed at the area, not an exact site.',
  4: 'Placed approximately: the source gives no coordinates.',
  5: 'Placed at the country: the source names no closer place.',
};

/** Feature properties as the history route sends them; times are epoch seconds. */
export type HistoryFeature = {
  id: number;
  kind: string;
  family: string;
  title?: string | null;
  t0: number;
  t1: number;
  prec: number;
  ongoing: number;
  geoPrec: number;
  magnitude?: number | null;
};

export type HistoryDetail = HistoryFeature & {
  tStart: number;
  tEnd: number | null;
  endPrec: number | null;
  attrs: Record<string, unknown>;
  source?: { code: string; name: string; attribution: string | null };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A time at its precision: "1910s", "1916", "Jul 1916", "1 Jul 1916"; years before 1 are BCE. */
export function formatAt(s: number, prec: number): string {
  const d = new Date(s * 1000);
  const y = d.getUTCFullYear();
  const year = y > 0 ? String(y) : `${1 - y} BCE`;
  if (prec === Prec.century) return y > 0 ? `${Math.floor((y - 1) / 100) + 1}th century` : year;
  if (prec === Prec.decade) return y > 0 ? `${Math.floor(y / 10) * 10}s` : year;
  if (prec <= Prec.year) return year;
  if (prec === Prec.month) return `${MONTHS[d.getUTCMonth()]} ${year}`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${year}`;
}

function when(p: HistoryFeature, d?: HistoryDetail | null): string {
  const start = formatAt(d?.tStart ?? p.t0, p.prec);
  if (p.ongoing) return `since ${start}`;
  if (!d || d.tEnd === null) return start;
  const end = formatAt(d.tEnd, d.endPrec ?? p.prec);
  return end === start ? start : `${start} – ${end}`;
}

const SKIP = new Set(['url', 'place', 'net', 'ids', 'status', 'sig', 't_raw', 'crit', 'dyads', 'eventid', 'alt_names', 'phase', 'specificity', 'vicinity', 'doubtterr', 'multiple', 'added_by_compiler']);

/** The attrs a reader can use: scalars and lists of strings, plus belligerents as "a vs b". */
function facts(attrs: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (SKIP.has(k) || v === null || v === '' || v === false) continue;
    let text: string | null = null;
    if (typeof v === 'string' || typeof v === 'number' || v === true) text = v === true ? 'yes' : String(v);
    else if (Array.isArray(v) && v.every(x => typeof x === 'string')) text = v.join(', ');
    else if (k === 'belligerents' && typeof v === 'object') {
      const b = v as { left?: string[]; right?: string[] };
      text = `${(b.left ?? []).join(', ')} vs ${(b.right ?? []).join(', ')}`;
    }
    if (!text) continue;
    const label = k.replace(/_/g, ' ');
    out.push([label.charAt(0).toUpperCase() + label.slice(1), text.length > 160 ? `${text.slice(0, 157)}…` : text]);
    if (out.length === 6) break;
  }
  return out;
}

export function historyPopupHtml(p: HistoryFeature, d?: HistoryDetail | null): string {
  const family = HISTORY_FAMILIES[p.family];
  const rows: PopRow[] = [
    { label: 'When', value: when(p, d) },
    { label: 'Kind', value: KINDS[p.kind] ?? p.kind },
  ];
  // Map features drop null properties, so a missing magnitude arrives as undefined.
  const magnitude = d?.magnitude ?? p.magnitude;
  if (typeof magnitude === 'number' && family?.magnitude) {
    rows.push({ label: family.magnitude, value: p.family === 'hazard' ? magnitude.toFixed(1) : Math.round(magnitude).toLocaleString('en-US'), mono: true });
  }
  for (const [k, v] of d ? facts(d.attrs) : []) rows.push({ label: k, value: v });
  const link = typeof d?.attrs.url === 'string' && /^https?:\/\//.test(d.attrs.url) ? d.attrs.url : null;
  const source = d?.source ? (d.source.attribution ?? d.source.name) : d === undefined ? 'Loading details…' : null;
  return pop({
    kicker: family?.label ?? 'Event',
    dot: family?.color ?? HISTORY_FALLBACK_COLOR,
    title: p.title ?? KINDS[p.kind] ?? p.kind,
    rows,
    note: [PLACEMENT[p.geoPrec], source].filter(Boolean).join(' ') || undefined,
    links: [link ? { href: link, label: 'Source page' } : null],
  });
}
