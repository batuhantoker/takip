'use client';

import { useEffect, useRef } from 'react';
import type { Highlight } from '@/lib/ai/assist/tools';
import { attachHighlights, type Highlighter } from '@/lib/ai/assist/highlights';
import type { MapRef } from '@/components/map/types';

export function useAiHighlights({ mapRef, mapReady, aiHighlight }: { mapRef: MapRef; mapReady: boolean; aiHighlight: Highlight | null }) {
  // AI Assist's marks: attached once the map is up, fed whatever the assistant marks.
  const highlighterRef = useRef<Highlighter | null>(null);
  const aiHighlightRef = useRef(aiHighlight);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const h = attachHighlights(mapRef.current);
    h.set(aiHighlightRef.current);
    highlighterRef.current = h;
    return () => { highlighterRef.current = null; h.destroy(); };
  }, [mapReady, mapRef]);
  useEffect(() => {
    aiHighlightRef.current = aiHighlight;
    highlighterRef.current?.set(aiHighlight);
  }, [aiHighlight]);
}
