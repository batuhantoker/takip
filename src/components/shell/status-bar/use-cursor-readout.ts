'use client';

import { useCallback, useRef, useState } from 'react';
import { createPointerPlace } from '@/lib/places/pointer-place';

const hemi = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v < 0 ? neg : pos}`;

/** "40.7128° N 74.0060° W": four places is about ten metres. */
export const formatPosition = (lat: number, lng: number) => `${hemi(lat, 'N', 'S')} ${hemi(lng, 'E', 'W')}`;

/** The status bar's pointer readout. Coordinates are written into the ref off React; the place is a store only CursorInfo subscribes to. */
export function useCursorReadout() {
  const coordsDisplayRef = useRef<HTMLSpanElement>(null);
  const [place] = useState(createPointerPlace);
  const pointed = useRef(false);

  const show = useCallback((coords: { lat: number; lng: number }) => {
    if (coordsDisplayRef.current) {
      coordsDisplayRef.current.textContent = formatPosition(coords.lat, coords.lng);
    }
    place.point(coords.lat, coords.lng);
  }, [place]);

  const handleMouseCoords = useCallback((coords: { lat: number; lng: number }) => {
    pointed.current = true;
    show(coords);
  }, [show]);
  /** Until the pointer first crosses the map, the readout follows the view's centre rather than sitting empty. */
  const showCentre = useCallback((coords: { lat: number; lng: number }) => {
    if (!pointed.current) show(coords);
  }, [show]);

  return { coordsDisplayRef, place, handleMouseCoords, showCentre };
}
