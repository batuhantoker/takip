import { htmlEsc, urlSafe } from './map-popups';

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

const STYLE = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;`;
const LINK = `display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;font-family:'JetBrains Mono',monospace;`;

/** "Go" is confirmed; everything else (TBD, TBC, Hold) is a plan that may move. */
export const launchColor = (status: unknown) => (status === 'Go' ? '#00E676' : status === 'Hold' ? '#FF9500' : '#4FC3F7');

export function launchPopupHtml(p: Props): string {
  const color = launchColor(p.status);
  let later: { name: string; when: string }[] = [];
  try {
    later = JSON.parse(String(p.later ?? '[]'));
  } catch { /* keep the popup without the list */ }
  const more = later.length
    ? `<div style="margin-top:8px;font-size:9px;color:#5C5A54;">ALSO FROM THIS PAD</div>${later.map(l =>
        `<div style="font-size:9px;color:#B0BEC5;">${htmlEsc(l.when)} · ${htmlEsc(l.name)}</div>`).join('')}`
    : '';
  return `<div style="${STYLE}border:1px solid ${color}40;max-width:280px;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">🚀 ${htmlEsc(p.name)}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${htmlEsc(p.pad)}${p.location ? ` · ${htmlEsc(p.location)}` : ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">NET</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.when)}</span></div>
          <div><span style="color:#5C5A54;">STATUS</span><br/><span style="color:${color};">${htmlEsc(p.status_name)}</span></div>
          <div><span style="color:#5C5A54;">PROVIDER</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.provider || '—')}</span></div>
          <div><span style="color:#5C5A54;">WEBCAST</span><br/><span style="color:#E8E6E0;">${p.webcast_live === true || p.webcast_live === 'true' ? 'LIVE' : '—'}</span></div>
        </div>${more}
        <div style="font-size:8px;color:#5C5A54;margin-top:6px;">Dates slip; NET means no earlier than.</div>
        <a href="${urlSafe(p.url)}" target="_blank" rel="noopener noreferrer" style="${LINK}color:${color};border:1px solid ${color}66;background:${color}1A;">LAUNCH LIBRARY 2</a>
      </div>`;
}
