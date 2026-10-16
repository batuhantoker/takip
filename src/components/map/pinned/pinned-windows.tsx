'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { useRing } from '@/components/map/inspect/rings';
import type { MapRef } from '@/components/map/types';
import { FloatingWindow, useWindowControls, WindowFoldButton } from '@/components/map/windows';
import { type Pin, pinStore, usePins } from './pin-store';

/**
 * Popups pinned as windows, each kept until closed. They belong to the mode they were pinned in
 * (`mode` changing closes them); a phone has no windows, so its popups offer no Pin.
 */
export function PinnedWindows({ mapRef, mode }: { mapRef: MapRef; mode: string }) {
  const isMobile = useIsMobile();
  const pins = usePins();
  useEffect(() => {
    pinStore.setEnabled(!isMobile);
    return () => pinStore.setEnabled(false);
  }, [isMobile]);
  useEffect(() => () => pinStore.clear(), [mode]);
  if (isMobile) return null;
  return <>{pins.map(p => <PinnedWindow key={p.id} pin={p} mapRef={mapRef} />)}</>;
}

function PinnedWindow({ pin, mapRef }: { pin: Pin; mapRef: MapRef }) {
  const body = useRef<HTMLDivElement>(null);
  useRing(pin.id, { lat: pin.at[1], lng: pin.at[0] });
  useLayoutEffect(() => {
    const node = pin.node;
    body.current?.appendChild(node);
    return () => node.remove();
  }, [pin.node]);

  const close = () => pinStore.unpin(pin.id);
  const zoomTo = () => {
    const map = mapRef.current;
    map?.flyTo({ center: pin.at, zoom: Math.max(map.getZoom(), 5), duration: 1200, essential: true });
  };
  return (
    <FloatingWindow id={pin.id} kind="pinned" label={pin.label} onClose={close}>
      <section className="tk-pinned flex max-h-full min-h-0 flex-col overflow-hidden rounded-float border border-line bg-surface-1 shadow-float">
        <PinHeader pin={pin} onZoom={zoomTo} onClose={close} />
        <div ref={body} className="styled-scrollbar min-h-0 flex-1 overflow-y-auto" />
      </section>
    </FloatingWindow>
  );
}

/** The kicker over the content's own title; folded, the title stands in for both. */
function PinHeader({ pin, onZoom, onClose }: { pin: Pin; onZoom: () => void; onClose: () => void }) {
  const folded = !!useWindowControls()?.collapsed;
  return (
    <header className="flex h-10 shrink-0 items-center gap-1.5 pr-1.5 pl-4">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: pin.dot }} />
      <span className={cx('min-w-0 flex-1 truncate text-meta font-medium', folded ? 'text-ink-1' : 'text-ink-3')} title={folded ? pin.label : undefined}>
        {folded ? pin.label : pin.kicker}
      </span>
      <IconButton label="Zoom to" icon={ZoomIn} size="sm" onClick={onZoom} />
      <WindowFoldButton size="sm" />
      <IconButton label="Close" kbd="Esc" icon={X} size="sm" onClick={onClose} />
    </header>
  );
}
