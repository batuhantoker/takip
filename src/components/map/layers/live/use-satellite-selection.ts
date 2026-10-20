'use client';

import { useCallback, useRef, useState } from 'react';
import type { createSatelliteLayer } from '@/lib/feeds/satellites/layer';
import type { SatelliteDetail } from '@/components/map/inspect/cards/satellite-inspect';
import type { SatelliteRow } from '@/components/map/types';

export function useSatelliteSelection() {
  const satLayerRef = useRef<ReturnType<typeof createSatelliteLayer> | null>(null);
  // pick() returns an index into the array last handed to setPoints, so the
  // matching catalogue rows are kept in the same order to resolve it.
  const satRowsRef = useRef<SatelliteRow[]>([]);
  /** Selects a satellite by catalogue index, as a click on it would; for a shared link. */
  const satSelectRef = useRef<((index: number, quiet?: boolean) => void) | null>(null);
  /** Index of the selected satellite in the array last handed to setPoints. */
  const satPickedRef = useRef<number | null>(null);
  /** The selection's NORAD id. The index moves whenever the catalogue is
   *  re-polled and re-filtered; the id does not, so it is what identifies the
   *  selection across a refresh and what discards a late orbit reply. */
  const satSelectedIdRef = useRef<string | null>(null);
  /** When the catalogue positions were propagated for, so an orbit can be drawn
   *  around the marker rather than around the moment it was clicked. */
  const satEpochRef = useRef<number | null>(null);
  const [selectedSat, setSelectedSat] = useState<SatelliteDetail | null>(null);

  /** Drops the selection: the ring, the orbit track and the readout together.
   *  Leaving any one of them behind is what made a closed popup look like a
   *  still-selected satellite. */
  const clearSat = useCallback(() => {
    if (satPickedRef.current === null && satSelectedIdRef.current === null) return;
    satPickedRef.current = null;
    satSelectedIdRef.current = null;
    satLayerRef.current?.setSelected(null);
    satLayerRef.current?.setOrbit(null);
    setSelectedSat(null);
  }, []);

  return { satLayerRef, satRowsRef, satSelectRef, satPickedRef, satSelectedIdRef, satEpochRef, selectedSat, setSelectedSat, clearSat };
}
