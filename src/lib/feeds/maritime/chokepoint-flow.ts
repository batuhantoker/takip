import { t } from '@/lib/core/i18n/active';
import { msg } from '@/lib/core/i18n/translator';
import { htmlEsc, pop, sentence } from '@/lib/map/popups/kit';

/** As /api/chokepoints sends them. */
export interface ChokepointFlowRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  latestDate: string | null;
  last7Mean: number | null;
  baselineMean: number | null;
  ratio: number | null;
  basis: 'capacity' | 'count';
  status: 'normal' | 'disrupted' | 'insufficient';
  series: { date: string; total: number; tanker: number; cargo: number }[];
  disruptionIds: string[];
}

export interface ChokepointDisruptionRow {
  id: string;
  name: string;
  typeLabel: string;
  alertLevel: string | null;
  fromDate: string | null;
  active: boolean;
  source: string;
}

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

const COLORS = { disrupted: '#FF1744', normal: '#26C6DA', insufficient: '#8A877F' } as const;
export const flowColor = (status: unknown) => COLORS[status as keyof typeof COLORS] ?? COLORS.insufficient;
const STATUS: Record<string, string> = { disrupted: msg('Disrupted'), normal: msg('Normal'), insufficient: msg('Insufficient') };

export function chokepointFlowFeatures(rows: ChokepointFlowRow[], disruptions: ChokepointDisruptionRow[] = []): GeoJSON.Feature<GeoJSON.Point>[] {
  const byId = new Map(disruptions.map(d => [d.id, d]));
  return rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => {
      const linked = r.disruptionIds.map(id => byId.get(id)).filter((d): d is ChokepointDisruptionRow => !!d);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
          id: r.id,
          name: r.name,
          status: r.status,
          // A red-alert disruption outranks a "normal" ratio: the baseline may already be the collapse.
          color: linked.some(d => d.active && d.alertLevel?.toUpperCase() === 'RED') ? '#FF6D00' : flowColor(r.status),
          ratio: r.ratio,
          basis: r.basis,
          latestDate: r.latestDate,
          last7Mean: r.last7Mean,
          baselineMean: r.baselineMean,
          totals: JSON.stringify(r.series.map(s => s.total)),
          disruptions: JSON.stringify(linked),
        },
      };
    });
}

/** Inline SVG of daily transits, oldest to newest. */
export function sparkline(values: number[], color: string, w = 220, h = 36): string {
  if (values.length < 2) return '';
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;margin-top:6px;"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts}"/></svg>`;
}

function parse<T>(v: unknown, fallback: T): T {
  try { return JSON.parse(String(v ?? '')) as T; } catch { return fallback; }
}

export function chokepointFlowPopupHtml(p: Props): string {
  const color = String(p.color ?? flowColor(p.status));
  const ratio = Number(p.ratio);
  const totals = parse<number[]>(p.totals, []);
  const disruptions = parse<ChokepointDisruptionRow[]>(p.disruptions, []);
  const pct = Math.round(ratio * 100);
  const basis = p.basis === 'capacity' ? 'capacity' : 'count';
  const verdict = p.status === 'insufficient'
    ? t('Too little history or traffic to rate.')
    : p.status === 'disrupted'
      ? t('{pct}% of its previous ~90 days ({basis, select, capacity {tanker tonnage} other {vessel count}}), below 85% for three days running.', { pct, basis })
      : t('{pct}% of its previous ~90 days ({basis, select, capacity {tanker tonnage} other {vessel count}}).', { pct, basis });
  const events = disruptions.map(d => `<div class="tk-pop-item-title"><span class="tk-pop-dot" style="background:${d.alertLevel?.toUpperCase() === 'RED' ? 'var(--red)' : 'var(--amber)'}"></span>${htmlEsc(d.name)}${d.fromDate ? ` · ${htmlEsc(t('since {date}', { date: d.fromDate.slice(0, 10) }))}` : ''}</div>`).join('');
  const status = String(p.status ?? '');
  return pop({
    kicker: t('Strait traffic'),
    dot: color,
    meta: STATUS[status] ? t(STATUS[status]) : sentence(p.status),
    title: p.name,
    body: `<div>${htmlEsc(verdict)}</div>${sparkline(totals, color)}
      <div class="tk-pop-note">${htmlEsc(t('Vessels a day, last 30 days to {date} (published weekly). Rated against this strait’s own recent past, so a long closure becomes its own baseline.', { date: String(p.latestDate ?? '—') }))}</div>
      ${events ? `<div class="tk-pop-label">${htmlEsc(t('Disruptions'))}</div>${events}` : ''}`,
    note: t('IMF PortWatch · daily transits'),
    links: [{ href: 'https://portwatch.imf.org/', label: 'PortWatch' }],
  });
}
