'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GlobeView } from '@/lib/space/globe-match';
import { onWorldRequest } from '@/lib/space/world-events';
import type { SpaceFocus } from '@/lib/space/worlds';
import type { SpaceRequest } from './space-shell';

/**
 * Whether the shell shows the map or space, and what space is centred on.
 * Entering from the map starts the camera over the map's own centre, so
 * leaving Earth begins where the operator was looking.
 */
export function useSpaceMode(mapEntry: () => SpaceRequest['entry'] | undefined) {
  const [inSpace, setInSpace] = useState(false);
  const [focus, setFocus] = useState<SpaceFocus>('earth');
  const [request, setRequest] = useState<SpaceRequest>({ focus: 'earth', ts: 0 });
  const inSpaceRef = useRef(inSpace);
  const entryRef = useRef(mapEntry);
  useEffect(() => { inSpaceRef.current = inSpace; entryRef.current = mapEntry; });

  const go = useCallback((req: Omit<SpaceRequest, 'ts' | 'entry'>) => {
    if (req.via === 'zoom' && inSpaceRef.current) return;
    setRequest({ ...req, entry: inSpaceRef.current ? undefined : entryRef.current(), ts: Date.now() });
    setFocus(req.focus);
    setInSpace(true);
  }, []);

  const enter = useCallback((f: SpaceFocus) => go({ focus: f }), [go]);
  /** Zoomed out past the whole globe: space opens on the globe's exact view, still moving outward. */
  const zoomOut = useCallback((globe: GlobeView) => go({ focus: 'earth', via: 'zoom', globe }), [go]);
  const exit = useCallback(() => setInSpace(false), []);

  useEffect(() => onWorldRequest(req => go(req)), [go]);

  return { inSpace, focus, request, enter, zoomOut, exit, setFocus };
}
