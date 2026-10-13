'use client';

import { useCallback, useRef, useState } from 'react';

const hemi = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v < 0 ? neg : pos}`;

/** "40.7128° N 74.0060° W": four places is about ten metres. */
export const formatPosition = (lat: number, lng: number) => `${hemi(lat, 'N', 'S')} ${hemi(lng, 'E', 'W')}`;

/** The status bar's pointer readout. Coordinates are written into the ref off React; the place name is reverse-geocoded, debounced. */
export function useCursorReadout() {
  const coordsDisplayRef = useRef<HTMLSpanElement>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const geocodeCache = useRef<Map<string, string>>(new Map());
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocodedPos = useRef<{ lat: number; lng: number } | null>(null);
  const pointed = useRef(false);

  const show = useCallback((coords: { lat: number; lng: number }) => {
    if (coordsDisplayRef.current) {
      coordsDisplayRef.current.textContent = formatPosition(coords.lat, coords.lng);
    }
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      if (lastGeocodedPos.current) {
        const d = Math.abs(coords.lat - lastGeocodedPos.current.lat) + Math.abs(coords.lng - lastGeocodedPos.current.lng);
        if (d < 0.5) return;
      }
      const gk = `${coords.lat.toFixed(1)},${coords.lng.toFixed(1)}`;
      if (geocodeCache.current.has(gk)) { setLocationLabel(geocodeCache.current.get(gk)!); lastGeocodedPos.current = coords; return; }
      try {
        /* Our own route, not Nominatim directly: it rounds the coordinate,
           caches the answer for everyone, and holds the app's request budget
           for the service — see lib/places/nominatim.ts. */
        const res = await fetch(`/api/geo/reverse?lat=${coords.lat}&lng=${coords.lng}`);
        if (res.ok) {
          const d = await res.json();
          // Open sea has no name; the coordinates stand alone there.
          const label: string = d.label || '';
          if (geocodeCache.current.size > 500) { const it = geocodeCache.current.keys(); for (let i = 0; i < 100; i++) { const k = it.next().value; if (k) geocodeCache.current.delete(k); } }
          geocodeCache.current.set(gk, label);
          setLocationLabel(label);
          lastGeocodedPos.current = coords;
        }
      } catch (e) { console.warn('[TAKIP] Suppressed error:', e instanceof Error ? e.message : e); }
    }, 3000);
  }, []);

  const handleMouseCoords = useCallback((coords: { lat: number; lng: number }) => {
    pointed.current = true;
    show(coords);
  }, [show]);
  /** Until the pointer first crosses the map, the readout follows the view's centre rather than sitting empty. */
  const showCentre = useCallback((coords: { lat: number; lng: number }) => {
    if (!pointed.current) show(coords);
  }, [show]);

  return { coordsDisplayRef, locationLabel, handleMouseCoords, showCentre };
}
