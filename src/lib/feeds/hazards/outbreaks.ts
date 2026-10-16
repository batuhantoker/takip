import { htmlEsc, pop, urlSafe } from '@/lib/map/popups/kit';

/** As /api/outbreaks sends them: one row per source × disease × country, at the country's centroid. */
export interface OutbreakRow {
  id: string;
  disease: string;
  country: string;
  iso2: string;
  lat: number;
  lng: number;
  title: string;
  url: string;
  published: string;
  source: string;
  level: number | null;
}

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

const LEVEL_COLORS = ['#9CCC65', '#9CCC65', '#FFB300', '#FF6D00', '#FF1744'];
export const outbreakColor = (level: unknown) => (typeof level === 'number' && level >= 1 ? LEVEL_COLORS[Math.min(level, 4)] : '#C5E1A5');

/** One ring per country: the place is only known to country level, so it is never drawn as a pin. */
export function outbreakFeatures(rows: OutbreakRow[]): GeoJSON.Feature<GeoJSON.Point>[] {
  const byCountry = new Map<string, OutbreakRow[]>();
  for (const r of rows) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    byCountry.set(r.iso2, [...(byCountry.get(r.iso2) ?? []), r]);
  }
  return [...byCountry.values()].map(group => {
    const level = Math.max(0, ...group.map(r => r.level ?? 0));
    const diseases = [...new Set(group.map(r => r.disease))];
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [group[0].lng, group[0].lat] },
      properties: {
        country: group[0].country,
        level: level || null,
        color: outbreakColor(level || null),
        count: diseases.length,
        label: `${group[0].country}: ${diseases.slice(0, 2).join(', ')}${diseases.length > 2 ? ` +${diseases.length - 2}` : ''}`,
        rows: JSON.stringify(group),
      },
    };
  });
}

export function outbreakPopupHtml(p: Props): string {
  let rows: OutbreakRow[] = [];
  try { rows = JSON.parse(String(p.rows ?? '[]')); } catch { /* the header still renders */ }
  const items = rows
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || b.published.localeCompare(a.published))
    .map(r => `<a href="${urlSafe(r.url)}" target="_blank" rel="noopener noreferrer">
      <span class="tk-pop-list-title"><span class="tk-pop-dot tk-pop-dot-inline" style="background:${outbreakColor(r.level)}"></span>${htmlEsc(r.disease)}${r.level ? ` · CDC level ${r.level}` : ''}</span>
      <span class="tk-pop-list-meta">${htmlEsc(r.source)} · ${htmlEsc(r.published.slice(0, 10))} · ${htmlEsc(r.title)}</span>
    </a>`).join('');
  return pop({
    kicker: 'Outbreak notices',
    dot: String(p.color ?? outbreakColor(null)),
    title: p.country,
    subtitle: 'Notices are country-level, not a location',
    body: items ? `<div class="tk-pop-list">${items}</div>` : undefined,
  });
}
