'use client';

import { useEffect, useRef } from 'react';
import type { Highlight } from '@/lib/oi/assist/tools';
import { attachHighlights, type Highlighter } from '@/lib/oi/highlights';
import type { MapRef } from '@/components/map/types';

export function useOiHighlights({ mapRef, mapReady, oiHighlight }: { mapRef: MapRef; mapReady: boolean; oiHighlight: Highlight | null }) {
  // OI Assist's marks: attached once the map is up, fed whatever the assistant marks.
  const highlighterRef = useRef<Highlighter | null>(null);
  const oiHighlightRef = useRef(oiHighlight);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const h = attachHighlights(mapRef.current);
    h.set(oiHighlightRef.current);
    highlighterRef.current = h;
    return () => { highlighterRef.current = null; h.destroy(); };
  }, [mapReady, mapRef]);
  useEffect(() => {
    oiHighlightRef.current = oiHighlight;
    highlighterRef.current?.set(oiHighlight);
  }, [oiHighlight]);
}
