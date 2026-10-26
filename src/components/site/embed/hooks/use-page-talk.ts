'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { FlyToTarget, MapCenter } from '@/components/shell/state/types';
import type { Highlight } from '@/lib/ai/assist/tools';
import { easeFor, markHighlight } from '@/lib/map/embed/marks';
import { fromPage, wire, type ToPage } from '@/lib/map/embed/messages';

const EASE_MS = 700;

const host = () => (window.parent !== window ? window.parent : null);

/**
 * The page framing this map (lib/map/embed/messages.ts): the places it marks, moving the camera only when they are out
 * of view, and where it flies. `ready` and `pick` tell it the map is up and which of its places was clicked here.
 * Another site's frame never hears from us: the messages go to our own origin only.
 */
export function usePageTalk({ zoom, center, setFlyTo }: { zoom: number; center: MapCenter | null; setFlyTo: Dispatch<SetStateAction<FlyToTarget | null>> }) {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const view = useRef({ zoom, center });
  useEffect(() => { view.current = { zoom, center }; }, [zoom, center]);

  useEffect(() => {
    const parent = host();
    if (!parent) return;
    const onMessage = (e: MessageEvent) => {
      const m = fromPage(e, location.origin, parent);
      if (!m) return;
      const { zoom, center } = view.current;
      if (m.type === 'fly') {
        setFlyTo({ lat: m.lat, lng: m.lon, zoom: m.zoom ?? zoom, quiet: true, ts: Date.now() });
        return;
      }
      setHighlight(m.mark && markHighlight(m.mark));
      const to = m.mark && center?.bounds && easeFor(m.mark.points, center.bounds, zoom);
      if (to) setFlyTo({ ...to, duration: EASE_MS, quiet: true, ts: Date.now() });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setFlyTo]);

  const say = useCallback((m: ToPage) => host()?.postMessage(wire(m), location.origin), []);
  const ready = useCallback(() => say({ type: 'ready' }), [say]);
  const pick = useCallback((id: string) => say({ type: 'click', id }), [say]);
  return { highlight, ready, pick };
}
