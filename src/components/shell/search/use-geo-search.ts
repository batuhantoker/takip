'use client';

import { useCallback, useRef, useState } from 'react';
import type { Hit } from './search-groups';

/** How close to fly for each kind /api/v1/geo/search returns. */
export const ZOOM_BY_KIND: Record<string, number> = { address: 18, street: 16, poi: 16, city: 12, region: 8, country: 5, place: 13, coordinate: 15 };

const parseCoords = (s: string): { lat: number; lng: number } | null => {
  const m = s.trim().match(/^([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
};

/** What was typed, and the places it matches; coordinates answer at once, words after a short pause. */
export function useGeoSearch(center: { lat: number; lng: number } | null) {
  const [value, setValue] = useState('');
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  // The query the current results answer, so "no results" is never shown for a search still on its way.
  const [answered, setAnswered] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((q: string) => {
    setValue(q);
    if (timerRef.current) clearTimeout(timerRef.current);

    const coords = parseCoords(q);
    if (coords) {
      abortRef.current?.abort();
      setLoading(false);
      setResults([{ label: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, context: 'Coordinates', ...coords, kind: 'coordinate', zoom: 15 }]);
      setAnswered(q);
      return;
    }
    if (q.trim().length < 2) { abortRef.current?.abort(); setResults([]); setLoading(false); setAnswered(q); return; }

    /* Through our own route, never straight to Nominatim: one cache and one
       budget for every visitor (see lib/places/nominatim.ts). It sends where the map
       is looking, so "Notre-Dame" over Montreal is the basilica, and abandons
       the lookup for an earlier keystroke, so a slow reply for "Par" can never
       land after the one for "Paris". */
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const bias = center ? `&lat=${center.lat}&lng=${center.lng}` : '';
        const res = await fetch(`/api/v1/geo/search?q=${encodeURIComponent(q)}${bias}`, { signal: ctrl.signal });
        const data = await res.json();
        if (ctrl.signal.aborted) return;
        setResults((data.results || []).map((r: { name: string; context: string; lat: number; lng: number; kind: string }) => ({
          label: r.name, context: r.context, lat: r.lat, lng: r.lng, kind: r.kind || 'place', zoom: ZOOM_BY_KIND[r.kind] ?? 13,
        })));
      } catch {
        // An abandoned lookup is not a failure; the newer one owns the list.
        if (ctrl.signal.aborted) return;
        setResults([]);
      }
      setAnswered(q);
      setLoading(false);
    }, 380);
  }, [center]);

  return { value, results, loading, answered, search };
}
