'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Move } from 'lucide-react';
import { getArea } from '@/components/map/windows/map-area';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { placeFreely, type OverlayId } from '../lib/model';
import { spotFromBox, type Box } from '../lib/spot';
import { updateLayout } from '../use-page-layout';

const NUDGE = 8;
const LEAP = 32;
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

const shifted = (r: DOMRect, dx: number, dy: number): Box => ({ left: r.left + dx, top: r.top + dy, right: r.right + dx, bottom: r.bottom + dy });

/**
 * A piece while arranging: outlined and covered, so a drag anywhere on it moves it rather than using it. Dropped,
 * it keeps that place (from its nearest corner); the arrow keys nudge it, Shift for a longer step.
 */
export default function PieceFrame({ id, label, children }: { id: OverlayId; label: string; children: ReactNode }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const from = useRef<{ x: number; y: number; at: DOMRect } | null>(null);
  const [shift, setShift] = useState<{ x: number; y: number } | null>(null);

  const place = (at: Box) => {
    updateLayout(l => placeFreely(l, id, spotFromBox(at, getArea())));
    // A piece leaving its corner mounts afresh in its own place; keep the keyboard on it.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-arrange="${id}"]`)?.focus());
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !box.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    from.current = { x: e.clientX, y: e.clientY, at: box.current.getBoundingClientRect() };
    setShift({ x: 0, y: 0 });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const f = from.current;
    if (f) setShift({ x: e.clientX - f.x, y: e.clientY - f.y });
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const f = from.current;
    if (!f) return;
    from.current = null;
    setShift(null);
    if (e.clientX !== f.x || e.clientY !== f.y) place(shifted(f.at, e.clientX - f.x, e.clientY - f.y));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const arrow = ARROWS[e.key];
    if (!arrow || !box.current) return;
    e.preventDefault();
    const step = e.shiftKey ? LEAP : NUDGE;
    place(shifted(box.current.getBoundingClientRect(), arrow[0] * step, arrow[1] * step));
  };

  return (
    <div ref={box} className="relative" style={shift ? { transform: `translate(${shift.x}px, ${shift.y}px)` } : undefined}>
      {children}
      <div role="button" tabIndex={0} data-arrange={id} aria-label={t('Move {name}: drag it, or use the arrow keys', { name: label })}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { from.current = null; setShift(null); }} onKeyDown={onKeyDown}
        className={cx(
          'pointer-events-auto absolute -inset-1 z-10 cursor-move touch-none rounded-float border-2 border-dashed border-accent bg-accent/10',
          shift && 'cursor-grabbing bg-accent/20',
          FOCUS_RING,
        )}>
        <span className="pointer-events-none absolute top-1 left-1 flex items-center gap-1 rounded-control bg-accent px-1.5 py-0.5 text-meta font-medium whitespace-nowrap text-on-accent">
          <Move aria-hidden className="size-3" strokeWidth={2} />
          {label}
        </span>
      </div>
    </div>
  );
}
