import type * as maplibregl from 'maplibre-gl';
import type { RefObject } from 'react';
import { flightPathFeatures, routeFor } from '@/lib/flight-path';
import type { AircraftDetail } from '@/lib/flight-watch';
import { EMPTY_FC } from '@/lib/map-base-layers';
import { flightPopupHtml, flightRouteEndsHtml, flightScheduleHtml, htmlEsc, idSafe, muted, type ScheduleReply } from '@/lib/map-popups';
import type { ShowPopup } from './types';

export function bindFlightClicks(map: maplibregl.Map, popup: ShowPopup, popupRef: RefObject<maplibregl.Popup | null>) {
  // A token for the aircraft whose route is drawn, so a slow reply for one
  // already deselected cannot draw over the current selection.
  let flightSel = 0;
  const setFlightPath = (fc: GeoJSON.FeatureCollection) =>
    (map.getSource('selected-flight') as maplibregl.GeoJSONSource | undefined)?.setData(fc as never);

  // ── Flights (with FlightAware + ADS-B Exchange links + ROUTE VISUALIZATION) ──
  ['fl-commercial','fl-private','fl-jets','fl-military'].forEach(layer => {
    map.on('click', layer, e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const cs = (p.callsign||'').trim();
      const icao = idSafe(p.icao24 || '');
      // The feed writes these fillers when the transponder sent nothing; with
      // an icao24 the lookup below is about to fill them, so show it pending.
      const known = (v: unknown, filler: string) => (v && v !== filler ? String(v) : icao ? '…' : '—');

      // Show initial popup immediately (without route data)
      const routeLoadingId = `route-info-${Date.now()}`;
      popup(coords, flightPopupHtml(p, coords, cs, icao, routeLoadingId, known));

      // Select after popup(): replacing the old popup fires its close, which clears the old route.
      const token = ++flightSel;
      setFlightPath(EMPTY_FC);
      popupRef.current?.on('close', () => {
        if (flightSel !== token) return;
        flightSel++;
        setFlightPath(EMPTY_FC);
      });

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

      // Fills the MODEL / REG cells in place; only the operator, which has no
      // cell of its own, goes on the line under the grid.
      const fill = (id: string, v: string | null | undefined, fallback = '—') => {
        const n = document.getElementById(id);
        if (n && (v || n.textContent === '…')) n.textContent = v || fallback;
      };
      acReq
        .then(d => {
          fill(`ac-model-${icao}`, d?.model || d?.typeCode);
          fill(`ac-reg-${icao}`, d?.registration);
          const op = document.getElementById(`ac-op-${icao}`);
          if (op) op.innerHTML = d ? htmlEsc(d.operator || '') : muted('AIRFRAME NOT IN REGISTRY');
        })
        .catch(() => {
          fill(`ac-model-${icao}`, null);
          fill(`ac-reg-${icao}`, null);
          const op = document.getElementById(`ac-op-${icao}`);
          if (op) op.innerHTML = muted('AIRFRAME LOOKUP UNAVAILABLE');
        });

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
        const here: [number, number] = [coords[0], coords[1]];
        const { origin, destination, scheduled } = routeFor(ac, sched, here);

        setFlightPath(flightPathFeatures({
          track: ac?.track ?? [], here, heading: Number(p.heading) || 0,
          origin, destination, landed: Boolean(ac?.arrival),
        }));

        const el = document.getElementById(routeLoadingId);
        if (!el) return;
        const tracked = (ac?.track?.length ?? 0) > 1 ? ' · FLOWN TRACK ON MAP' : '';
        if (!origin && !destination) {
          el.innerHTML = sched?.found ? muted(`SCHEDULED ROUTE DOES NOT MATCH THIS FLIGHT${tracked}`)
            : a.status === 'rejected' && s.status === 'rejected' ? muted('ROUTE UNAVAILABLE')
            : muted(`NO SCHEDULED ROUTE${tracked}`);
          return;
        }
        const ends = flightRouteEndsHtml(origin, destination);
        if (scheduled && sched?.found) {
          el.innerHTML = flightScheduleHtml(ends, sched);
        } else {
          el.innerHTML = ends + muted(ac?.arrival ? 'LANDED' : 'DESTINATION UNKNOWN');
        }
      });
    });
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  });
}
