import type * as maplibregl from 'maplibre-gl';
import { alprTip } from '@/lib/feeds/cameras/alpr-describe';
import { ALPR_PICK_LAYERS } from '@/lib/feeds/cameras/alpr-layers';
import { FLIGHT_LAYER_LABEL } from '@/components/map/inspect/live';
import type { FlightLayer } from '@/components/map/inspect/types';
import { STILL_KNOTS } from '@/lib/map/course';
import { toFeet } from '@/lib/feeds/aviation/flight-watch';
import { windText } from '@/lib/feeds/aviation-weather/popups';
import { htmlEsc } from '@/lib/map/popups/kit';
import { firePerimeterTip } from '@/lib/feeds/hazards/fire-perimeters';
import { EMERGENCY_PICK } from '@/lib/feeds/aviation/emergency';
import { nhcTip } from '@/lib/feeds/hazards/nhc-forecast';
import { SHIP_CLASSES } from '@/lib/feeds/maritime/ship-filter';
import { flowTip, trafficTip } from '@/lib/feeds/traffic/describe';
import { TRAFFIC_FLOW_LAYER, TRAFFIC_LAYER } from '@/lib/feeds/traffic/map-layers';
import { transitTipMeta, transitTitle } from '@/lib/feeds/transit/describe';
import type { SatelliteRow } from '@/components/map/types';

const DELAY_MS = 150;
const OFFSET = 14;

type Tip = { key: string; name: string; meta: string };
type Props = Record<string, unknown>;

const n = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const mono = (s: string) => `<span class="tk-mono">${htmlEsc(s)}</span>`;
const join = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(' · ');

/** Layers that get a tooltip, in the order they win when stacked. */
const DESCRIBE: Record<string, (p: Props, layer: string) => Tip | null> = {
  [EMERGENCY_PICK]: p => { const t = flight(p, String(p.layer)); return { ...t, meta: join([`<span class="tk-fg-red">${htmlEsc(String(p.declared))}</span>`, t.meta]) }; },
  'fl-military': flight, 'fl-jets': flight, 'fl-private': flight, 'fl-commercial': flight,
  'cctv-clusters': p => ({ key: `cluster:${p.cluster_id}`, name: `${Number(p.point_count).toLocaleString()} cameras`, meta: 'Click to zoom in' }),
  'cctv-dots': p => ({ key: `camera:${p.id}`, name: String(p.name || 'Camera'), meta: htmlEsc(join(['Camera', [p.city, p.country].filter(Boolean).join(', '), p.offline === true && 'Off air'])) }),
  'alert-pin-dots': p => ({ key: `alert:${p.id}`, name: String(p.title || 'Report'), meta: htmlEsc(join([p.kind === 'rocket' ? 'Rocket alert' : p.kind === 'event' ? 'Event' : 'News', String(p.place_name || '')])) }),
  'eq-circles': p => {
    const m = n(p.magnitude);
    const depth = n(p.depth);
    return { key: `quake:${p.id}`, name: m == null ? 'Earthquake' : `Magnitude ${m.toFixed(1)}`, meta: join([htmlEsc(String(p.place || '')), depth == null ? null : mono(`${Math.round(depth)} km deep`)]) };
  },
  'airport-wx-dots': p => ({ key: `metar:${p.id}`, name: String(p.id || 'Station'), meta: join([p.cat ? mono(String(p.cat)) : 'No flight category', htmlEsc(windText(p) ?? '')]) }),
  'nhc-points': (p, layer) => { const t = nhcTip(p, layer); return { ...t, meta: htmlEsc(t.meta) }; },
  'nhc-cone-fill': (p, layer) => { const t = nhcTip(p, layer); return { ...t, meta: htmlEsc(t.meta) }; },
  'fire-perimeter-fill': p => { const t = firePerimeterTip(p); return { ...t, meta: htmlEsc(t.meta) }; },
  'sigmet-fill': p => ({ key: `sigmet:${p.id}`, name: String(p.title || 'SIGMET'), meta: htmlEsc(join([p.firName ? `${p.firName} FIR` : null, 'SIGMET'])) }),
  'ship-arrows': ship, 'ship-dots': ship,
  'transit-icons': transit, 'transit-dots': transit,
  [TRAFFIC_LAYER]: p => { const t = trafficTip(p); return { ...t, meta: htmlEsc(t.meta) }; },
  [TRAFFIC_FLOW_LAYER]: p => { const t = flowTip(p); return { ...t, meta: htmlEsc(t.meta) }; },
  ...Object.fromEntries(ALPR_PICK_LAYERS.map(id => [id, (p: Props) => { const t = alprTip(p); return t && { ...t, meta: htmlEsc(t.meta) }; }])),
  'transit-city-dots': p => ({ key: `transit-city:${p.name}`, name: String(p.name || 'City'), meta: htmlEsc(join([String(p.modes || 'Live transit'), 'Click to zoom in'])) }),
};
const LAYERS = Object.keys(DESCRIBE);

function flight(p: Props, layer: string): Tip {
  const alt = n(p.alt), kt = n(p.speed_knots);
  const id = String(p.icao24 || p.callsign || '');
  return {
    key: `aircraft:${id}`,
    name: String(p.callsign || '').trim() || id.toUpperCase() || 'Aircraft',
    meta: join([FLIGHT_LAYER_LABEL[layer as FlightLayer], alt == null ? null : alt < 30 && (kt ?? 0) < 50 ? 'on the ground' : mono(`${toFeet(alt).toLocaleString()} ft`), kt == null || kt < 1 ? null : mono(`${Math.round(kt)} kt`)]),
  };
}

function ship(p: Props): Tip {
  const kn = n(p.speed);
  const name = String(p.name || '').trim();
  return {
    key: `ship:${p.mmsi}`,
    name: name && name !== String(p.mmsi) ? name : 'Unnamed vessel',
    meta: join([htmlEsc(SHIP_CLASSES.find(c => c.type === p.type)?.label ?? 'Vessel'), kn == null ? null : kn < STILL_KNOTS ? 'stopped' : mono(`${kn.toFixed(1)} kn`)]),
  };
}

function transit(p: Props): Tip {
  return { key: `transit:${p.key}`, name: transitTitle(p), meta: transitTipMeta(p, mono) };
}

const satTip = (s: SatelliteRow): Tip => ({
  key: `satellite:${s.noradId ?? s.name}`,
  name: s.name,
  meta: join([s.mission && s.mission !== 'Unknown' ? htmlEsc(s.mission) : 'Satellite', mono(`${Math.round(s.alt).toLocaleString()} km`)]),
});

/**
 * A small label after a short hover on a ship, aircraft, bus, satellite, camera, quake or alert pin.
 * One element, moved once per animation frame; nothing in React re-renders.
 */
export function bindHoverTip(map: maplibregl.Map, inspected: (key: string) => boolean, paused: () => boolean = () => false) {
  // A touch screen has no hover; a tap must not leave a tooltip behind.
  if (!window.matchMedia('(hover: hover)').matches) return { setSatellite() {}, dispose() {} };
  const el = document.createElement('div');
  el.className = 'tk-hover-tip';
  el.setAttribute('role', 'tooltip');
  map.getContainer().appendChild(el);

  let frame = 0;
  let point: maplibregl.Point | null = null;
  let shown: string | null = null;
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sat: SatelliteRow | null = null;

  const hide = () => {
    clearTimeout(timer);
    pending = shown = null;
    el.classList.remove('is-on');
  };

  const place = (p: maplibregl.Point) => {
    const box = map.getContainer().getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    const x = p.x + OFFSET + w > box.width ? p.x - OFFSET - w : p.x + OFFSET;
    const y = p.y + OFFSET + h > box.height ? p.y - OFFSET - h : p.y + OFFSET;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };

  const update = () => {
    frame = 0;
    if (!point || map.isMoving() || paused()) { hide(); return; }
    const present = LAYERS.filter(id => map.getLayer(id));
    const f = present.length ? map.queryRenderedFeatures(point, { layers: present })[0] : undefined;
    const tip = f?.layer ? DESCRIBE[f.layer.id]?.(f.properties ?? {}, f.layer.id) ?? null : sat ? satTip(sat) : null;
    if (!tip || inspected(tip.key)) { hide(); return; }
    if (tip.key === shown) { place(point); return; }
    if (tip.key === pending) return;
    // A new thing under the pointer: swap the text now, show it once the pointer rests.
    clearTimeout(timer);
    el.classList.remove('is-on');
    shown = null;
    pending = tip.key;
    el.innerHTML = `<div class="tk-hover-tip-name">${htmlEsc(tip.name)}</div>${tip.meta ? `<div class="tk-hover-tip-meta">${tip.meta}</div>` : ''}`;
    timer = setTimeout(() => {
      if (pending !== tip.key || !point) return;
      shown = tip.key;
      pending = null;
      place(point);
      el.classList.add('is-on');
    }, DELAY_MS);
  };

  const onMove = (e: maplibregl.MapMouseEvent) => {
    // A held button is a drag, never a hover.
    if ((e.originalEvent as MouseEvent).buttons || (e.originalEvent as PointerEvent).pointerType === 'touch') { hide(); return; }
    point = e.point;
    frame ||= requestAnimationFrame(update);
  };
  const onLeave = () => { point = null; hide(); };

  map.on('mousemove', onMove);
  map.on('mouseout', onLeave);
  map.on('movestart', hide);
  map.on('click', hide);

  return {
    /** The satellite under the pointer, from the satellite layer's own hover pick. */
    setSatellite(row: SatelliteRow | null) {
      if (row === sat) return;
      sat = row;
      if (point) frame ||= requestAnimationFrame(update);
    },
    dispose() {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      map.off('mousemove', onMove);
      map.off('mouseout', onLeave);
      map.off('movestart', hide);
      map.off('click', hide);
      el.remove();
    },
  };
}
