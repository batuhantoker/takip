import { Prec } from '@takip/core/time';
import { htmlEsc, urlSafe } from './map-popups';

/* Popups for the curated history layer (replay mode): wars, battles, claims, attacks, tariffs, heritage. */

export const HISTORY_FAMILIES: Record<string, { color: string; label: string; magnitude?: string }> = {
  conflict: { color: '#FF1744', label: 'Conflict', magnitude: 'DEATHS' },
  terror: { color: '#FF9100', label: 'Attack', magnitude: 'KILLED' },
  territorial: { color: '#B388FF', label: 'Territory' },
  econ: { color: '#00E5A0', label: 'Trade', magnitude: 'TRADE ($BN)' },
  heritage: { color: '#40C4FF', label: 'Heritage' },
  hazard: { color: '#F9A825', label: 'Natural hazards', magnitude: 'M' },
  politics: { color: '#FF80AB', label: 'Treaties and coups' },
  nuclear: { color: '#C6FF00', label: 'Nuclear explosions', magnitude: 'YIELD (KT)' },
};
export const HISTORY_FALLBACK_COLOR = '#B0BEC5';

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
  'econ.tariff': 'Tariff',
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
    out.push([k.replace(/_/g, ' ').toUpperCase(), text.length > 160 ? `${text.slice(0, 157)}…` : text]);
    if (out.length === 6) break;
  }
  return out;
}

const STYLE = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:14px;font-family:var(--font-hud);max-width:320px;`;

export function historyPopupHtml(p: HistoryFeature, d?: HistoryDetail | null): string {
  const family = HISTORY_FAMILIES[p.family];
  const color = family?.color ?? HISTORY_FALLBACK_COLOR;
  const cell = (label: string, value: string) =>
    `<div><span style="color:#5C5A54;">${htmlEsc(label)}</span><br/><span style="color:#E8E6E0;">${htmlEsc(value)}</span></div>`;
  const cells = [cell('WHEN', when(p, d)), cell('KIND', KINDS[p.kind] ?? p.kind)];
  // Map features drop null properties, so a missing magnitude arrives as undefined.
  const magnitude = d?.magnitude ?? p.magnitude;
  if (typeof magnitude === 'number' && family?.magnitude) {
    cells.push(cell(family.magnitude, p.family === 'hazard' ? magnitude.toFixed(1) : Math.round(magnitude).toLocaleString('en-US')));
  }
  for (const [k, v] of d ? facts(d.attrs) : []) cells.push(cell(k, v));
  const placement = PLACEMENT[p.geoPrec];
  const link = typeof d?.attrs.url === 'string' && /^https?:\/\//.test(d.attrs.url) ? d.attrs.url : null;
  return `<div style="${STYLE}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:8px;">${htmlEsc(p.title ?? KINDS[p.kind] ?? p.kind)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;">${cells.join('')}</div>
        ${placement ? `<div style="font-size:8px;color:#8A877F;margin-top:8px;">${placement}</div>` : ''}
        ${link ? `<a href="${urlSafe(link)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:9px;letter-spacing:0.1em;color:${color};text-decoration:none;">SOURCE PAGE ↗</a>` : ''}
        ${d?.source ? `<div style="font-size:8px;color:#5C5A54;margin-top:6px;">${htmlEsc(d.source.attribution ?? d.source.name)}</div>` : d === undefined ? `<div style="font-size:8px;color:#5C5A54;margin-top:6px;">Loading…</div>` : ''}
      </div>`;
}
