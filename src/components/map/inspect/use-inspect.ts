'use client';

import { useCallback, useMemo, useState } from 'react';
import { windowStore } from '@/components/map/windows';
import type { InspectSink, InspectTarget } from './types';

/** The window id for a card, the same key the hover tooltip uses. */
export const inspectId = (t: Pick<InspectTarget, 'kind' | 'id'>) => `${t.kind}:${t.id}`;

/** Every aircraft and ship with a card open, oldest first. Satellites keep their own state in the map. */
export function useInspect(onOpen?: () => void) {
  const [targets, setTargets] = useState<InspectTarget[]>([]);

  const open = useCallback((t: InspectTarget) => {
    // A camera's window is its player, which the page opens.
    if (t.kind === 'camera') return;
    onOpen?.();
    setTargets(prev => (prev.some(p => p.kind === t.kind && p.id === t.id) ? prev : [...prev, t]));
    // Already open: bring it forward, unfolded.
    windowStore.expand(inspectId(t));
  }, [onOpen]);

  const patch = useCallback<InspectSink['patch']>((kind, id, p) => {
    setTargets(prev => prev.map(t => (t.kind === kind && t.id === id ? ({ ...t, ...p } as InspectTarget) : t)));
  }, []);

  const close = useCallback((t: Pick<InspectTarget, 'kind' | 'id'>) => {
    setTargets(prev => prev.filter(p => !(p.kind === t.kind && p.id === t.id)));
  }, []);
  const closeAll = useCallback(() => setTargets([]), []);
  const sink = useMemo<InspectSink>(() => ({ open: t => { open(t); return true; }, patch }), [open, patch]);

  return { targets, open, patch, close, closeAll, sink };
}
