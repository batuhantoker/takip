import type { Box } from './bbox';
import type { ReferenceDataset } from './catalog';

const MAX_POPUP_ROWS = 14;

/**
 * The box to request for a view: the bounds pushed outward to whole tiles at
 * this zoom. Small pans then reuse the same URL (and the HTTP cache), and the
 * extra margin means a pan shows data before the next request lands.
 */
export function snapBox(bounds: { west: number; south: number; east: number; north: number }, zoom: number): Box {
  const step = 360 / 2 ** zoom;
  const west = Math.floor(bounds.west / step) * step;
  const east = Math.ceil(bounds.east / step) * step;
  const south = Math.max(-90, Math.floor(bounds.south / step) * step);
  const north = Math.min(90, Math.ceil(bounds.north / step) * step);
  if (east - west >= 360) return [-180, south, 180, north];
  return [west, south, east, north];
}

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Popup body for a clicked feature: its title, then its fields as a table. */
export function popupHtml(dataset: ReferenceDataset, props: Record<string, unknown>): string {
  const title = props[dataset.titleProp] ?? dataset.label;
  const rows = Object.entries(props)
    .filter(([k, v]) => k !== dataset.titleProp && v !== null && v !== '')
    .slice(0, MAX_POPUP_ROWS)
    .map(([k, v]) => {
      const text = Array.isArray(v) ? v.join(', ') : String(v);
      const value = /^https?:\/\//i.test(text)
        ? `<a href="${esc(text)}" target="_blank" rel="noopener noreferrer" style="color:${dataset.color};">link</a>`
        : esc(text);
      return `<tr><td style="color:#5C5A54;padding:2px 10px 2px 0;vertical-align:top;">${esc(k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toUpperCase())}</td><td style="color:#E8E6E0;">${value}</td></tr>`;
    })
    .join('');
  return `<div style="background:rgba(12,14,26,0.95);border:1px solid ${dataset.color}4D;border-radius:10px;padding:14px;font-family:'JetBrains Mono',monospace;">
    <div style="color:${dataset.color};font-size:13px;font-weight:700;margin-bottom:2px;">${esc(title)}</div>
    <div style="color:#5C5A54;font-size:9px;letter-spacing:0.1em;margin-bottom:8px;">${esc(dataset.label.toUpperCase())}</div>
    <table style="font-size:9px;border-collapse:collapse;">${rows}</table>
    <div style="margin-top:8px;color:#5C5A54;font-size:8px;">${esc(dataset.attribution)}</div>
  </div>`;
}
