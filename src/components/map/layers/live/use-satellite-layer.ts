'use client';

import { useCallback, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { SatelliteDetail } from '@/components/map/inspect/cards/satellite-inspect';
import { satColorFor, type MapPalette } from '@/lib/map/style/palette';
import { shownSatellites } from '@/lib/feeds/satellites/filter';
import { parseColor, SAT_MAX_ZOOM, type SatPoint } from '@/lib/feeds/satellites/points';
import type { LayerHookArgs, MapRef, SatelliteLayer, SatelliteRow } from '@/components/map/types';

interface SatelliteLayerArgs extends LayerHookArgs {
  palette: MapPalette;
  satLayerRef: RefObject<SatelliteLayer | null>;
  satRowsRef: RefObject<SatelliteRow[]>;
  satPickedRef: RefObject<number | null>;
  satSelectedIdRef: RefObject<string | null>;
  satEpochRef: RefObject<number | null>;
  setSelectedSat: Dispatch<SetStateAction<SatelliteDetail | null>>;
  clearSat: () => void;
}

export function useSatelliteLayer({
  mapReady, data, activeLayers, setGeo, palette,
  satLayerRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, setSelectedSat, clearSat,
}: SatelliteLayerArgs) {
  /** Catalogue rows -> the packed form the 3D layer draws. */
  const toSatPoints = useCallback((rows: SatelliteRow[]): SatPoint[] => rows.map((s) => ({
    lng: s.lng,
    lat: s.lat,
    altKm: s.alt,
    color: parseColor(satColorFor(s.category, s.color, palette)),
    // Stations are the ones an operator is usually looking for, so they get
    // to be findable in a field of several hundred identical dots.
    size: s.category === 'science' || /ISS|TIANGONG/i.test(s.name || '') ? 2.2 : 1,
  })), [palette]);

  /**
   * Re-points the selection at the same satellite after a refresh.
   *
   * pick() returns an index into the last setPoints() array, and every poll
   * rebuilds that array — a filtered one changes length as well as order. Left
   * as a bare index the highlight ring quietly slides onto whichever satellite
   * now sits at that slot, taking the readout with it.
   */
  const resyncSatSelection = useCallback((rows: SatelliteRow[]) => {
    const id = satSelectedIdRef.current;
    if (!id) return;
    const i = rows.findIndex(r => r.noradId === id);
    // Filtered out, or gone from the catalogue: there is nothing to point at.
    if (i < 0) { clearSat(); return; }
    satPickedRef.current = i;
    satLayerRef.current?.setSelected(i);
    // The satellite has moved since it was clicked; the readout should say where
    // it is now, not where it was.
    setSelectedSat(prev => (prev ? { ...prev, lat: rows[i].lat, lng: rows[i].lng, alt: rows[i].alt } : prev));
  }, [clearSat, satSelectedIdRef, satPickedRef, satLayerRef, setSelectedSat]);

  useEffect(() => {
    if (!mapReady) return;
    const sats = data.satellites || [];
    const al = activeLayers as any;
    const at = Date.parse(data.satellites_at ?? '');
    satEpochRef.current = Number.isFinite(at) ? at : null;
    
    const shown: SatelliteRow[] = shownSatellites(sats, al);
    if (!shown.length) {
      setGeo('satellites', []);
      satRowsRef.current = [];
      satLayerRef.current?.setPoints([]);
      clearSat();
      return;
    }
    setGeo('satellites', shown.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, color: satColorFor(s.category, s.color, palette), mission: s.mission, alt: s.alt, noradId: s.noradId, category: s.category } })));
    satRowsRef.current = shown;
    satLayerRef.current?.setPoints(toSatPoints(shown));
    resyncSatSelection(shown);
  }, [mapReady, data.satellites, activeLayers.satellites, (activeLayers as any).sat_comms, (activeLayers as any).sat_military, (activeLayers as any).sat_navigation, (activeLayers as any).sat_earth, (activeLayers as any).sat_science, data.satellites_at, setGeo, toSatPoints, resyncSatSelection, clearSat]);
}

interface SatelliteDismissArgs {
  mapRef: MapRef;
  mapReady: boolean;
  selectedSat: SatelliteDetail | null;
  clearSat: () => void;
}

export function useSatelliteDismiss({ mapRef, mapReady, selectedSat, clearSat }: SatelliteDismissArgs) {
  // Zooming past the ceiling takes the satellites off the map, so a readout
  // left over from before the zoom would be describing something no longer
  // there — and its ring and orbit are already gone.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !selectedSat) return;
    const onZoom = () => { if (map.getZoom() > SAT_MAX_ZOOM) clearSat(); };
    onZoom();
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [mapReady, selectedSat, clearSat, mapRef]);
}
