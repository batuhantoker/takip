import type { ReportView } from './report-view';

const LAYERS_NAMED = 3;
// The api's own check (apps/api/src/reports/schemas.ts): a path here, never another site.
const SITE_PATH = /^\/(?![/\\])[^\s\\]*$/;
const MODES = { live: 'Live', replay: 'Replay', history: 'History' } as const;

/** Replay: "Oct 15, 2026, 08:30 UTC". History: the year, or the age in deep time, which is stored as written. */
function moment(view: ReportView) {
  if (!view.time) return null;
  const at = new Date(view.time);
  if (!view.time.includes('T') || Number.isNaN(at.getTime())) return view.time;
  if (view.mode === 'history') {
    const year = at.getUTCFullYear();
    return year > 0 ? String(year) : `${1 - year} BC`;
  }
  return `${at.toLocaleString('en', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} UTC`;
}

function layers(keys: string[] | undefined) {
  if (!keys?.length) return 'no layers';
  const named = keys.slice(0, LAYERS_NAMED).join(', ');
  return keys.length > LAYERS_NAMED ? `${named} +${keys.length - LAYERS_NAMED} more` : named;
}

/** The view's link when it is a path on this site; the console opens nothing else. */
export const siteLink = (view: ReportView) => (view.link && SITE_PATH.test(view.link) ? view.link : null);

/** A report's view in a few short pieces, most telling first: mode and time, zoom, base map, layers, then the rest. */
export function summarizeView(view: ReportView): string[] {
  const mode = view.mode ? MODES[view.mode] : null;
  const when = moment(view);
  const parts = [
    mode && (when ? `${mode} at ${when}` : mode),
    view.space && `in space (${view.space})`,
    view.track && `following ${view.track}`,
    view.zoom !== undefined && `zoom ${view.zoom}`,
    [view.baseMap, view.projection].filter(Boolean).join(', ') || null,
    view.layers && layers(view.layers),
    view.panel && `${view.panel} open`,
    view.point && `clicked ${view.point.lat.toFixed(4)}, ${view.point.lng.toFixed(4)}`,
    view.viewport && `${view.viewport.width}×${view.viewport.height}`,
    view.version,
  ];
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0);
}
