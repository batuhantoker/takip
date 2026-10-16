import type * as maplibregl from 'maplibre-gl';
import type { InspectSink, FlightLayer, RouteState } from '@/components/map/inspect/types';
import { flightPathFeatures, routeFor } from '@/lib/feeds/aviation/flight-path';
import type { AircraftDetail } from '@/lib/feeds/aviation/flight-watch';
import { EMPTY_FC } from '@/lib/map/basemap/bands/shared';
import { EMERGENCY_PICK } from '@/lib/feeds/aviation/emergency';
import { idSafe, type ScheduleReply } from '@/lib/map/popups/layer-popups';

const FLIGHT_LAYERS: FlightLayer[] = ['fl-commercial', 'fl-private', 'fl-jets', 'fl-military'];

/** What a click on an aircraft knows before any lookup. */
export interface FlightPick {
  icao24?: string;
  callsign?: string;
  alt?: number;
  speed_knots?: number;
  heading?: number;
  model?: string;
  registration?: string;
}

export interface FlightSelector {
  select: (p: FlightPick, coords: [number, number], layer: FlightLayer) => void;
  /** Forget the selection's route, e.g. when the card moves on to something else. */
  clear: () => void;
  /** The aircraft whose route is drawn. */
  drawn: () => string | null;
}

export function bindFlightClicks(map: maplibregl.Map, sink: InspectSink, drawing: () => boolean): FlightSelector {
  // A token for the aircraft whose route is drawn, so a slow reply for one
  // already deselected cannot draw over the current selection.
  let flightSel = 0;
  let drawnId: string | null = null;
  const setFlightPath = (fc: GeoJSON.FeatureCollection) =>
    (map.getSource('selected-flight') as maplibregl.GeoJSONSource | undefined)?.setData(fc as never);

  const select = (p: FlightPick, coords: [number, number], layer: FlightLayer) => {
    const cs = String(p.callsign || '').trim();
    const icao = idSafe(p.icao24 || '');
    const id = icao || cs;
    if (!id) return;
    // The feed writes these fillers when the transponder sent nothing.
    const known = (v: unknown, filler: string) => (v && v !== filler ? String(v) : undefined);
    const opened = sink.open({
      kind: 'aircraft', id, icao24: icao, callsign: cs, layer,
      lng: coords[0], lat: coords[1],
      alt: p.alt, speed: p.speed_knots, heading: p.heading,
      model: known(p.model, 'Unknown'), registration: known(p.registration, 'N/A'),
      airframe: icao ? 'loading' : null,
      route: { status: 'loading' },
    });
    if (!opened) return;
    const token = ++flightSel;
    drawnId = id;
    setFlightPath(EMPTY_FC);

    // The live feed carries no identity for most aircraft, so resolve the
    // model and registration out of band. A 404 is an answer; anything
    // else is a failed lookup and must not read as "not in registry".
    const acReq: Promise<AircraftDetail | null> = icao
      ? fetch(`/api/aircraft?icao24=${encodeURIComponent(icao)}`).then(r => {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
      : Promise.resolve(null);
    acReq
      .then(d => { if (flightSel === token) sink.patch('aircraft', id, { airframe: d }); })
      .catch(() => { if (flightSel === token) sink.patch('aircraft', id, { airframe: 'unavailable' }); });

    // The schedule is keyed by callsign and often names another leg of the
    // aircraft's day, so it is only shown and drawn where it agrees with
    // the reported track and position.
    const cleanCallsign = cs.replace(/\s+/g, '');
    const routeParams = new URLSearchParams({
      callsign: cleanCallsign,
      icao24: p.icao24 || '',
      lat: String(coords[1]),
      lng: String(coords[0]),
      speed: String(p.speed_knots || 0),
    });
    const schedReq = cleanCallsign
      ? fetch(`/api/flight-route?${routeParams}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      : Promise.resolve(null);

    Promise.allSettled([acReq, schedReq]).then(([a, s]) => {
      if (flightSel !== token) return;
      const ac = a.status === 'fulfilled' ? a.value : null;
      const sched = s.status === 'fulfilled' ? s.value as ScheduleReply | null : null;
      const { origin, destination, scheduled } = routeFor(ac, sched, coords);

      setFlightPath(flightPathFeatures({
        track: ac?.track ?? [], here: coords, heading: Number(p.heading) || 0,
        origin, destination, landed: Boolean(ac?.arrival),
      }));

      const tracked = (ac?.track?.length ?? 0) > 1;
      let route: RouteState;
      if (!origin && !destination) {
        route = sched?.found ? { status: 'mismatch', tracked }
          : a.status === 'rejected' && s.status === 'rejected' ? { status: 'unavailable', tracked }
          : { status: 'none', tracked };
      } else {
        route = { status: 'found', origin, destination, schedule: scheduled && sched?.found ? sched : null, landed: Boolean(ac?.arrival) };
      }
      sink.patch('aircraft', id, { route });
    });
  };

  FLIGHT_LAYERS.forEach(layer => {
    map.on('click', layer, e => {
      if (!e.features?.length || drawing()) return;
      const f = e.features[0];
      select(f.properties as FlightPick, (f.geometry as GeoJSON.Point).coordinates as [number, number], layer);
    });
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  });
  // An aircraft in distress is drawn on its own layer, and opens as the layer it belongs to.
  map.on('click', EMERGENCY_PICK, e => {
    const f = e.features?.[0];
    if (!f || drawing()) return;
    select(f.properties as FlightPick, (f.geometry as GeoJSON.Point).coordinates as [number, number], f.properties.layer as FlightLayer);
  });
  map.on('mouseenter', EMERGENCY_PICK, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', EMERGENCY_PICK, () => { map.getCanvas().style.cursor = ''; });

  return {
    select,
    clear: () => { flightSel++; drawnId = null; setFlightPath(EMPTY_FC); },
    drawn: () => drawnId,
  };
}
