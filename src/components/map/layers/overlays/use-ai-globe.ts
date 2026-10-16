'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { attachAi, type AiGlobe } from '@/lib/ai/globe/attach';
import type { MapPalette } from '@/lib/map/style/palette';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface AiGlobeArgs {
  mapRef: MapRef;
  mapReady: boolean;
  aiGlobeRef: RefObject<AiGlobe | null>;
  paletteRef: RefObject<MapPalette>;
  onAiGlobe: WorldMapProps['onAiGlobe'];
  onAiSelect: WorldMapProps['onAiSelect'];
  onAiHover: WorldMapProps['onAiHover'];
  onAiFollow: WorldMapProps['onAiFollow'];
}

export function useAiGlobe({ mapRef, mapReady, aiGlobeRef, paletteRef, onAiGlobe, onAiSelect, onAiHover, onAiFollow }: AiGlobeArgs) {
  const onAiGlobeRef = useRef(onAiGlobe);
  const onAiSelectRef = useRef(onAiSelect);
  const onAiHoverRef = useRef(onAiHover);
  const onAiFollowRef = useRef(onAiFollow);
  useEffect(() => {
    onAiGlobeRef.current = onAiGlobe;
    onAiSelectRef.current = onAiSelect;
    onAiHoverRef.current = onAiHover;
    onAiFollowRef.current = onAiFollow;
  }, [onAiGlobe, onAiSelect, onAiHover, onAiFollow]);

  // TAKIP AI — a prediction drawn as it happens: actors, the events of the
  // simulated worlds and arcs through the sky (see lib/ai/globe). The page feeds it
  // run state directly, so the map does not re-render on every event; the
  // layer re-adds itself after a style change.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const globe = attachAi(mapRef.current, {
      onSelect: key => onAiSelectRef.current?.(key),
      onHover: hover => onAiHoverRef.current?.(hover),
      onFollowChange: following => onAiFollowRef.current?.(following),
    });
    globe.setColors({ support: paletteRef.current.aiSupport, oppose: paletteRef.current.aiOppose, neutral: paletteRef.current.aiNeutral });
    aiGlobeRef.current = globe;
    onAiGlobeRef.current?.(globe);
    return () => {
      aiGlobeRef.current = null;
      onAiGlobeRef.current?.(null);
      globe.destroy();
    };
  }, [mapReady, mapRef, aiGlobeRef, paletteRef]);
}
