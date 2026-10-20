'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { msg } from '@/lib/core/i18n/translator';
import type { FlightBucket, FlightHit } from '@/lib/feeds/aviation/flight-search';

/** The map layer that draws each kind of aircraft, and what to call it. */
export const FLIGHT_KIND: Record<FlightBucket, { layer: 'flights' | 'private' | 'jets' | 'military'; label: string }> = {
  commercial_flights: { layer: 'flights', label: msg('Commercial') },
  private_flights: { layer: 'private', label: msg('Private') },
  private_jets: { layer: 'jets', label: msg('Business jet') },
  military_flights: { layer: 'military', label: msg('Military') },
};

/** Worth asking the flights search: letters, digits, spaces and hyphens, as callsigns, registrations and airline names are. */
export const isFlightQuery = (q: string) => /^[\p{L}\p{N}][\p{L}\p{N} '-]{1,39}$/u.test(q.trim());

/** Aircraft in the air now that match what was typed; asked after a short pause, and only the latest answer kept. */
export function useFlightSearch(center: { lat: number; lng: number } | null, limit = 5) {
  const [answer, setAnswer] = useState<{ q: string; hits: FlightHit[] }>({ q: '', hits: [] });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Where the map is looking only breaks ties; panning shouldn't ask again.
  const centerRef = useRef(center);
  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); abortRef.current?.abort(); }, []);

  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    if (!isFlightQuery(q)) { setAnswer({ q, hits: [] }); return; }
    timerRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const c = centerRef.current;
      const bias = c ? `&lat=${c.lat.toFixed(3)}&lng=${c.lng.toFixed(3)}` : '';
      try {
        const res = await fetch(`/api/flights/search?q=${encodeURIComponent(q.trim())}&limit=${limit}${bias}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!ctrl.signal.aborted) setAnswer({ q, hits: Array.isArray(data.results) ? data.results : [] });
      } catch {
        if (!ctrl.signal.aborted) setAnswer({ q, hits: [] });
      }
    }, 300);
  }, [limit]);

  return { answer, search };
}
