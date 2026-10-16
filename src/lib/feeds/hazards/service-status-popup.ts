import { htmlEsc, pop, urlSafe } from '@/lib/map/popups/kit';

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

export const indicatorColor = (indicator: unknown) =>
  indicator === 'critical' || indicator === 'major' ? '#FF1744' : indicator === 'minor' ? '#FF9500' : indicator === 'maintenance' ? '#4FC3F7' : '#9E9E9E';

interface VendorRow { name: string; indicator: string; description: string; url: string; incidents: { name: string; status: string; url: string | null }[] }

/** One pin per HQ city; `vendors` arrives as a JSON string because map feature properties are flat. */
export function serviceStatusPopupHtml(p: Props): string {
  let vendors: VendorRow[] = [];
  try {
    vendors = JSON.parse(String(p.vendors ?? '[]'));
  } catch { /* an empty card is better than none */ }
  const rows = vendors.map(v => {
    const incidents = v.incidents.slice(0, 3).map(i =>
      `<a href="${urlSafe(i.url)}" target="_blank" rel="noopener noreferrer"><span class="tk-pop-list-title">${htmlEsc(i.name)}</span><span class="tk-pop-list-meta">${htmlEsc(i.status)}</span></a>`).join('');
    return `<div class="tk-pop-item">
      <a class="tk-pop-item-title" href="${urlSafe(v.url)}" target="_blank" rel="noopener noreferrer"><span class="tk-pop-dot" style="background:${indicatorColor(v.indicator)}"></span>${htmlEsc(v.name)}</a>
      <div class="tk-pop-list-meta">${htmlEsc(v.description)}</div>
      ${incidents ? `<div class="tk-pop-list">${incidents}</div>` : ''}
    </div>`;
  }).join('');
  return pop({
    kicker: 'Service status',
    dot: indicatorColor(p.worst),
    title: p.city,
    body: rows || undefined,
    note: 'Self-reported status pages, pinned at the vendor’s HQ, not where the outage is.',
  });
}
