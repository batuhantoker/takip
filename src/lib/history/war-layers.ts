import { pop } from '@/lib/map/popups/kit';

/* Wartime border layers for History: who held what, month by month, coloured by alignment. */

export type Alignment = 'axis' | 'occupied' | 'belligerent' | 'allied' | 'neutral' | 'none';

/** Diverging blue ↔ red, desaturated to sit under labels; occupation also gets a hatch. The History legend reads these. */
export const ALIGNMENTS: { key: Alignment; label: string; color: string }[] = [
  { key: 'axis', label: 'Axis and aligned', color: '#C9625C' },
  { key: 'occupied', label: 'Occupied by the Axis', color: '#9E7A77' },
  { key: 'belligerent', label: 'At war, in neither bloc', color: '#8C80C2' },
  { key: 'neutral', label: 'Neutral', color: '#76808A' },
  { key: 'allied', label: 'Allies', color: '#5A8CCB' },
  { key: 'none', label: 'Not at war', color: '#343B44' },
];

/** `start` and `end` bound the borders' months; Play runs between them. */
export type WarLayer = { code: string; label: string; years: string; note: string; start: number; end: number; view: { lat: number; lng: number; zoom: number } };

export const WAR_LAYERS: WarLayer[] = [{
  code: 'ww2-europe',
  label: 'World War II in Europe',
  years: '1938–1945',
  note: 'Each month shows the borders as they stood at its end, from annexations; occupation shows as a status, not a border.',
  start: Date.UTC(1938, 1, 1),
  end: Date.UTC(1945, 4, 31),
  view: { lat: 47, lng: 17, zoom: 3.05 },
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
  // t1 is the first of the month after the last one shown.
  const last = p.t1 === null ? null : month(p.t1 - 1);
  return pop({
    kicker: a.label,
    dot: a.color,
    title: p.name,
    rows: [
      { label: 'Status', value: p.status && p.status !== a.label ? p.status : null },
      { label: 'These borders', value: last === null ? `from ${month(p.t0)}` : last === month(p.t0) ? last : `${month(p.t0)} – ${last}` },
      { label: 'Head of state', value: p.head },
      { label: 'Government in exile', value: p.exile },
    ],
    note: attribution ?? undefined,
  });
}
