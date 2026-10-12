import { htmlEsc } from '@/lib/map-popups';

/* Wartime border layers for History: who held what, month by month, coloured by alignment. */

export type Alignment = 'axis' | 'occupied' | 'belligerent' | 'allied' | 'neutral' | 'none';

/** Diverging blue ↔ red (dataviz palette) with grey for neither side; occupation also gets a hatch. */
export const ALIGNMENTS: { key: Alignment; label: string; color: string }[] = [
  { key: 'axis', label: 'Axis and aligned', color: '#e66767' },
  { key: 'occupied', label: 'Occupied by the Axis', color: '#b98b8b' },
  { key: 'belligerent', label: 'At war, in neither bloc', color: '#a58bd6' },
  { key: 'neutral', label: 'Neutral', color: '#8a877f' },
  { key: 'allied', label: 'Allies', color: '#5598e7' },
  { key: 'none', label: 'Not at war', color: '#4f4e4a' },
];

export type WarLayer = { code: string; label: string; years: string; note: string; start: number; view: { lat: number; lng: number; zoom: number } };

export const WAR_LAYERS: WarLayer[] = [{
  code: 'ww2-europe',
  label: 'World War II in Europe',
  years: '1938–1945',
  note: 'Borders at each month’s end, from annexations; occupation shows as a status, not a border.',
  start: Date.UTC(1938, 1, 28),
  view: { lat: 50, lng: 17, zoom: 3.2 },
}];

/** Feature properties as /api/replay/history/features sends them; times are epoch seconds. */
export type WarFeature = { id: number; name: string; status: string | null; alignment: Alignment; head: string | null; exile: string | null; t0: number; t1: number | null };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const month = (s: number) => {
  const d = new Date(s * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export function warPopupHtml(p: WarFeature, attribution: string | null): string {
  const a = ALIGNMENTS.find(x => x.key === p.alignment) ?? ALIGNMENTS[ALIGNMENTS.length - 1];
  const row = (label: string, value: string | null) => (value
    ? `<div><span style="color:#5C5A54;">${htmlEsc(label)}</span><br/><span style="color:#E8E6E0;">${htmlEsc(value)}</span></div>` : '');
  const span = p.t1 === null ? `from ${month(p.t0)}` : `${month(p.t0)} – ${month(p.t1)}`;
  return `<div style="background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:14px;font-family:var(--font-hud);max-width:300px;border:1px solid ${a.color}55;">
      <div style="color:${a.color};font-size:12px;font-weight:700;margin-bottom:8px;">${htmlEsc(p.name)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;">
        ${row('STATUS', p.status ?? a.label)}${row('THESE BORDERS', span)}${row('HEAD OF STATE', p.head)}${row('GOVERNMENT IN EXILE', p.exile)}
      </div>
      ${attribution ? `<div style="font-size:8px;color:#5C5A54;margin-top:8px;">${htmlEsc(attribution)}</div>` : ''}
    </div>`;
}
