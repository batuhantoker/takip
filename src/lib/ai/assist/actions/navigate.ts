/** go_to, move, layers, open, map_view, link, track, untrack, clear: working the map itself. */
import { LAYERS, PANELS } from '../catalog';
import type { Lookup, Outcome, Site } from '../tools';
import { pickEntity } from './search';
import { fail, given, isSite, numIn, ok, placeOf, point, sleep, str, strings, zoomFor } from './shared';

export async function goTo(a: Record<string, unknown>, site: Site): Promise<Outcome> {
  const coords = point(a);
  const place = coords ? { name: str(a.place) || `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`, ...coords } : await placeOf(site, a.place);
  if (!place) return fail('go_to', `Could not find "${str(a.place)}" on the map`);
  const zoom = numIn(a.zoom, 1, 18) ?? zoomFor('kind' in place ? place.kind : undefined);
  site.flyTo(place.lat, place.lng, zoom);
  return ok('go_to', `Flew to ${place.name} (${place.lat.toFixed(2)}, ${place.lng.toFixed(2)}), zoom ${zoom}`, undefined,
    { kind: 'place', title: place.name, items: [{ label: place.name, detail: `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`, lat: place.lat, lng: place.lng }] });
}

export function move(a: Record<string, unknown>, site: Site): Outcome {
  if (!site.move) return fail('move', 'The camera cannot be moved from here');
  const pan = ['north', 'south', 'east', 'west'].includes(a.pan as string) ? a.pan as 'north' : undefined;
  const said = site.move({
    zoomBy: numIn(a.zoom_by, -12, 12) ?? undefined,
    tilt: numIn(a.tilt, 0, 85) ?? undefined,
    rotateBy: numIn(a.rotate_by, -360, 360) ?? undefined,
    northUp: a.north_up === true,
    pan,
    orbit: a.orbit === true ? 30 : numIn(a.orbit, 5, 120) ?? undefined,
    world: a.world === true,
    stop: a.stop === true,
  });
  return said ? ok('move', said) : fail('move', 'Say how to move: zoom_by, tilt, rotate_by, north_up, pan, orbit, world or stop');
}

export function layers(a: Record<string, unknown>, site: Site): Outcome {
  const known = site.layers();
  const on = strings(a.on).filter(k => k in LAYERS && k in known);
  const off = strings(a.off).filter(k => k in LAYERS && k in known);
  const unknown = [...strings(a.on), ...strings(a.off)].filter(k => !(k in LAYERS) || !(k in known));
  if (!on.length && !off.length) return fail('layers', unknown.length ? `No such layers: ${unknown.join(', ')}` : 'No layers named');
  site.setLayers(on, off);
  return ok('layers', [on.length ? `on: ${on.join(', ')}` : '', off.length ? `off: ${off.join(', ')}` : '', unknown.length ? `unknown: ${unknown.join(', ')}` : ''].filter(Boolean).join(' · '));
}

export function open(a: Record<string, unknown>, site: Site): Outcome {
  const panel = str(a.panel, 30).toLowerCase();
  if (!(panel in PANELS)) return fail('open', `No panel "${panel}". Panels: ${Object.keys(PANELS).join(', ')}`);
  if (a.close === true) {
    if (!site.closePanel) return fail('open', 'Panels cannot be closed from here');
    site.closePanel(panel);
    return ok('open', `Closed ${panel}`);
  }
  site.openPanel(panel);
  return ok('open', `Opened ${panel}`);
}

export function mapView(a: Record<string, unknown>, site: Site): Outcome {
  const projection = a.projection === 'flat' || a.projection === 'mercator' ? 'mercator' : a.projection === 'globe' ? 'globe' : undefined;
  const style = a.style === 'satellite' || a.style === 'dark' ? a.style : undefined;
  if (!projection && !style) return fail('map_view', 'Give projection ("globe" or "flat") or style ("dark" or "satellite")');
  site.setView({ projection, style });
  return ok('map_view', [projection ? (projection === 'globe' ? 'globe' : 'flat map') : '', style ? `${style} basemap` : ''].filter(Boolean).join(', '));
}

export function clear(_a: Record<string, unknown>, site: Site): Outcome {
  site.highlight(null);
  if (site.memo) site.memo.marks = null;
  return ok('clear', 'Cleared the highlights');
}

/* ───────────── Following ───────────── */

const TRACK = /^(aircraft|ship|satellite):([A-Za-z0-9]{1,12})$/;

export async function track(a: Record<string, unknown>, site: Site, signal?: AbortSignal): Promise<Outcome> {
  if (!site.track) return fail('track', 'Nothing can be tracked from here');
  const picked = await pickEntity(a, site, signal);
  if (typeof picked === 'string') return fail('track', picked);
  const { kind, entity: e } = picked;
  const id = kind === 'aircraft' ? e.id.toLowerCase() : e.id;
  site.track({ kind, id });
  // The map finds the target and opens its card on its own time; wait a moment for its answer.
  let status = site.tracked?.()?.status ?? 'tracking';
  for (let i = 0; i < 12 && status === 'acquiring'; i++) {
    await sleep(250, signal);
    status = site.tracked?.()?.status ?? 'tracking';
  }
  if (status === 'not-found') return fail('track', `The map could not find ${e.title} to follow; it may have just left the feed`);
  const doing = status === 'acquiring' ? 'Asked the map to follow' : 'Following';
  return ok('track', `${doing} ${e.title} (${kind} ${e.id})${e.detail ? `: ${e.detail}` : ''}`, { kind, id: e.id, name: e.title, status, ...(e.lat !== null ? { lat: e.lat, lng: e.lng } : {}) }, {
    kind: 'place', title: `${doing} ${e.title}`, subtitle: kind,
    items: [{ label: e.title, detail: e.detail || undefined, ...(e.lat !== null && e.lng !== null ? { lat: e.lat, lng: e.lng } : {}) }],
  });
}

export function untrack(_a: Record<string, unknown>, site: Site): Outcome {
  if (!site.untrack) return fail('untrack', 'Nothing is tracked here');
  const was = site.tracked?.();
  site.untrack();
  return ok('untrack', was ? `Stopped tracking ${was.kind} ${was.id}` : 'Nothing was being tracked');
}

/* ───────────── Links ───────────── */

export function viewLink(origin: string, v: { lat: number; lng: number; zoom: number; layers?: string[]; track?: string | null }): string {
  const q = new URLSearchParams({ lat: v.lat.toFixed(4), lon: v.lng.toFixed(4), zoom: v.zoom.toFixed(1) });
  if (v.layers?.length) q.set('layers', v.layers.join(','));
  if (v.track) q.set('track', v.track);
  return `${origin.replace(/\/+$/, '')}/?${q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':')}`;
}

/** A link to a view: the page's own view by default, or a place. Runs on the server too (show_in_takip). */
export async function link(a: Record<string, unknown>, lk: Lookup): Promise<Outcome> {
  const origin = lk.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  if (!origin) return fail('link', 'There is no address to link to here');
  let at: { lat: number; lng: number; zoom: number; name?: string };
  if (given(a.place) || point(a)) {
    const p = point(a) ?? await placeOf(lk, a.place);
    if (!p) return fail('link', `Could not find "${str(a.place)}" on the map`);
    at = { ...p, zoom: numIn(a.zoom, 1, 18) ?? zoomFor('kind' in p ? p.kind as string : undefined) };
  } else if (isSite(lk)) {
    const v = lk.view();
    at = { lat: v.lat, lng: v.lng, zoom: numIn(a.zoom, 1, 18) ?? v.zoom };
  } else {
    return fail('link', 'Give a place (or lat and lng) to link to');
  }
  const asked = strings(a.layers);
  const on = asked.length ? asked.filter(k => k in LAYERS) : isSite(lk) ? Object.keys(LAYERS).filter(k => lk.layers()[k]) : [];
  const tracked = str(a.track, 40);
  const trackArg = TRACK.test(tracked) ? tracked : !tracked && isSite(lk) && lk.tracked?.() ? `${lk.tracked()!.kind}:${lk.tracked()!.id}` : null;
  const url = viewLink(origin, { ...at, layers: on, track: trackArg });
  return ok('link', `Link: ${url}`, { url }, { kind: 'link', title: 'Open in TAKIP', items: [{ label: 'name' in at && at.name ? at.name : 'This view', detail: url, url }] });
}
