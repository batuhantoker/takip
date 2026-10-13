import type * as maplibregl from 'maplibre-gl';
import type { RefObject } from 'react';
import type { AlertPinFeature } from '@/lib/alerts/map-pins';
import { alertPopupHtml } from '@/lib/map/popups/layer-popups';
import type { ShowPopup } from '@/components/map/types';

export function bindAlertPins(map: maplibregl.Map, popup: ShowPopup, popupRef: RefObject<maplibregl.Popup | null>, alertPinsRef: RefObject<AlertPinFeature[]>, openAlertPinRef: RefObject<((id: string) => void) | null>) {
  // ── Live Alert pins: the report, the place it names, and its footage ──
  /* Several reports can name the same town; they stack, newest first. */
  const reportsAt = (coords: [number, number], leadId?: string) => {
    const seen = new Set<string>();
    return alertPinsRef.current
      .filter(f => f.geometry.coordinates[0] === coords[0] && f.geometry.coordinates[1] === coords[1])
      .map(f => f.properties)
      .filter(p => !seen.has(p.id) && seen.add(p.id))
      .sort((a, b) => (a.id === leadId ? -1 : b.id === leadId ? 1 : Date.parse(b.published) - Date.parse(a.published)));
  };

  /** Rings the pin a popup is open on, and clears the ring when it closes. */
  const markSelected = (id: string) => {
    try { map.setFilter('alert-pin-selected', ['==', ['get','id'], id]); } catch { /* style not settled */ }
  };
  const openAlertPopup = (feature: AlertPinFeature, leadId?: string) => {
    popup(feature.geometry.coordinates, alertPopupHtml(reportsAt(feature.geometry.coordinates, leadId)));
    markSelected(feature.properties.id);
    popupRef.current?.once('close', () => markSelected(''));
  };

  map.on('click', 'alert-pin-dots', e => {
    // Matched by id: a rendered feature's geometry is tile-quantised, so it
    // does not equal the coordinates the pin was placed at.
    const ids = new Set((e.features ?? []).map(f => f.properties?.id));
    const lead = alertPinsRef.current.find(f => ids.has(f.properties.id));
    if (lead) openAlertPopup(lead);
  });

  openAlertPinRef.current = (id: string) => {
    const f = alertPinsRef.current.find(x => x.properties.id === id);
    if (f) openAlertPopup(f, id);
  };
}
