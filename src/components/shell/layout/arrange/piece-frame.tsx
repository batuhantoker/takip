'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Move } from 'lucide-react';
import { getArea } from '@/components/map/windows/map-area';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { ANCHORS, placeFreely, type Anchor, type FreeSpot, type OverlayId } from '../lib/model';
import { presetSpot, snapTo, spotFromBox, type Box, type Neighbour } from '../lib/spot';
import { updateLayout } from '../use-page-layout';
import { setDragging } from './arrange-state';

const NUDGE = 8;
const LEAP = 32;
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
// As a number pad lays them out: 7 is the top left, 5 the middle, 3 the bottom right.
const PAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

const shifted = (r: DOMRect, dx: number, dy: number): Box => ({ left: r.left + dx, top: r.top + dy, right: r.right + dx, bottom: r.bottom + dy });

/** Every other piece on the map as it stands, for a drag to line up against. */
const neighboursOf = (id: OverlayId): Neighbour[] =>
  [...document.querySelectorAll<HTMLElement>('[data-piece]')]
    .filter(el => el.dataset.piece !== id)
    .map(el => ({ box: el.getBoundingClientRect(), anchor: el.dataset.anchor as Anchor }));

/**
 * A piece while arranging: outlined and covered, so a drag anywhere on it moves it rather than using it. Near one of
 * the nine preset places, or the side of another piece, it takes that place when dropped; anywhere else it stays
 * where it lands. The arrow keys nudge it (Shift for a longer step) and 1 to 9 send it to a preset place.
 */
export default function PieceFrame({ id, anchor, label, children }: { id: OverlayId; anchor: Anchor; label: string; children: ReactNode }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const from = useRef<{ x: number; y: number; at: DOMRect; neighbours: Neighbour[] } | null>(null);
  const [shift, setShift] = useState<{ x: number; y: number } | null>(null);

  const put = (spot: FreeSpot) => {
    updateLayout(l => placeFreely(l, id, spot));
    // A piece leaving its corner mounts afresh in its own place; keep the keyboard on it.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-arrange="${id}"]`)?.focus());
  };
  const end = () => {
    from.current = null;
    setShift(null);
    setDragging(null);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !box.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = box.current.getBoundingClientRect();
    from.current = { x: e.clientX, y: e.clientY, at, neighbours: neighboursOf(id) };
    setShift({ x: 0, y: 0 });
    setDragging({ id, width: at.width, height: at.height, snap: null });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const f = from.current;
    if (!f) return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y;
    setShift({ x: dx, y: dy });
    const snap = snapTo(shifted(f.at, dx, dy), getArea(), f.neighbours);
    setDragging({ id, width: f.at.width, height: f.at.height, snap: snap && { box: snap.box, preset: snap.preset } });
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const f = from.current;
    if (!f) return;
    end();
    if (e.clientX === f.x && e.clientY === f.y) return;
    const dropped = shifted(f.at, e.clientX - f.x, e.clientY - f.y);
    const area = getArea();
    put(snapTo(dropped, area, f.neighbours)?.spot ?? spotFromBox(dropped, area));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const preset = PAD.indexOf(e.key);
    if (preset >= 0) {
      e.preventDefault();
      put(presetSpot(ANCHORS[preset]));
      return;
    }
    const arrow = ARROWS[e.key];
    if (!arrow || !box.current) return;
    e.preventDefault();
    const step = e.shiftKey ? LEAP : NUDGE;
    put(spotFromBox(shifted(box.current.getBoundingClientRect(), arrow[0] * step, arrow[1] * step), getArea()));
  };

  return (
    <div ref={box} data-piece={id} data-anchor={anchor} className="relative" style={shift ? { transform: `translate(${shift.x}px, ${shift.y}px)` } : undefined}>
      {children}
      <div role="button" tabIndex={0} data-arrange={id} aria-label={t('Move {name}: drag it, use the arrow keys, or 1 to 9 for a preset place', { name: label })}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={end} onKeyDown={onKeyDown}
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
