import { htmlEsc, urlSafe } from './map-popups';

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

const STYLE = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:var(--font-hud);`;

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
    const color = indicatorColor(v.indicator);
    const incidents = v.incidents.slice(0, 3).map(i =>
      `<div style="font-size:9px;color:#B0BEC5;margin-left:8px;">· <a href="${urlSafe(i.url)}" target="_blank" rel="noopener noreferrer" style="color:#B0BEC5;">${htmlEsc(i.name)}</a> <span style="color:#5C5A54;">(${htmlEsc(i.status)})</span></div>`).join('');
    return `<div style="margin-top:6px;"><a href="${urlSafe(v.url)}" target="_blank" rel="noopener noreferrer" style="color:${color};font-size:11px;font-weight:700;text-decoration:none;">${htmlEsc(v.name)}</a> <span style="font-size:9px;color:#aaa;">${htmlEsc(v.description)}</span>${incidents}</div>`;
  }).join('');
  return `<div style="${STYLE}border:1px solid ${indicatorColor(p.worst)}40;max-width:320px;">
        <div style="color:${indicatorColor(p.worst)};font-size:12px;font-weight:700;">SERVICE STATUS · ${htmlEsc(p.city)}</div>${rows}
        <div style="font-size:8px;color:#5C5A54;margin-top:8px;">Self-reported status pages, pinned at the vendor's HQ, not where the outage is.</div>
      </div>`;
}
