'use client';

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { cx, ENTER } from '@/components/ui/class-names';
import { place, type Align, type Side } from '@/components/ui/position';
import { measure, partInView, partsOf, sameShot, scrollerOf, scrollToPart, type Shot } from '../lib/measure';
import { endTour, setTourPart, stepTour, tourHeading, tourPart, useTourPart, useTourStops } from '../tour-state';
import { TourCard } from './tour-card';

const IGNORED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn']);
const BACK = new Set(['ArrowLeft', 'ArrowUp', 'Backspace']);

/**
 * The dimmed screen with each target ringed, and the card beside the first. Any key or click goes on.
 * On a stop with a panel, the panel scrolls under the wheel and the tour follows the section in view.
 */
export function TourLayer({ at }: { at: number }) {
  const stops = useTourStops();
  const stop = stops[Math.min(at, stops.length - 1)];
  const part = useTourPart();
  const card = useRef<HTMLDivElement>(null);
  const [shot, setShot] = useState<Shot>({ boxes: [], anchor: null, parts: [] });
  // A part reached by the wheel is already in view; one reached by a key is scrolled to.
  const followed = useRef(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Inside a panel, or with the panel itself ringed, the card goes beside the panel; the timeline's goes above it.
  const inDock = !!shot.anchor?.closest('[data-tour="dock"]');
  // A phone's bottom-bar button has room only above it.
  const inBar = !!shot.anchor?.closest('[data-bottom-bar]');
  const side: Side | undefined = inDock ? 'right' : part !== null || inBar ? 'top' : stop.side;
  const align: Align = inDock ? 'start' : part !== null || inBar ? 'center' : stop.align ?? 'center';

  // Panels fade in and pieces slide as the dock opens, so the rings keep up. Layout, so a new stop never paints the last one's rings.
  useLayoutEffect(() => {
    // Two empty looks in a row, not one: a piece can mount a frame after the stop does.
    let misses = 0;
    const look = () => {
      const next = measure(stop, part);
      if (stop.onlyWhenSeen && part === null && !next.boxes.length && ++misses >= 2) {
        stepTour(tourHeading());
        return;
      }
      if (next.boxes.length) misses = 0;
      setShot(prev => (sameShot(prev, next) ? prev : next));
    };
    look();
    const timer = setInterval(look, 120);
    window.addEventListener('resize', look);
    return () => { clearInterval(timer); window.removeEventListener('resize', look); };
  }, [stop, part]);

  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    const box = shot.anchor ? shot.boxes[0] : null;
    const p = box && side
      ? place(new DOMRect(box.x, box.y, box.w, box.h), size, side, align, 12, 12)
      : { x: Math.round((innerWidth - size.width) / 2), y: Math.round((innerHeight - size.height) / 2) };
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.visibility = 'visible';
    // `at` too: two stops in a row with nothing to ring measure the same, and the new card would stay hidden.
  }, [shot, side, align, part, at]);

  useEffect(() => {
    card.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, [at, part]);

  useEffect(() => {
    if (part === null) return;
    if (followed.current) { followed.current = false; return; }
    const p = partsOf(stop)[part];
    if (p) scrollToPart(p.el);
  }, [stop, part]);

  useEffect(() => () => clearTimeout(wheelTimer.current), []);

  const count = shot.parts.length;
  const next = () => (part !== null && part + 1 < count ? setTourPart(part + 1) : stepTour(1));
  const back = () => (part !== null ? setTourPart(part > 0 ? part - 1 : null) : stepTour(-1));

  // Capture on window runs before the map's keys, the shortcuts and Escape's stack, so none of them fire underneath.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (IGNORED.has(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    const inCard = !!card.current?.contains(e.target as Node);
    if (inCard && (e.key === 'Enter' || e.key === ' ')) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Tab') {
      const buttons = [...(card.current?.querySelectorAll<HTMLElement>('button') ?? [])];
      const i = buttons.indexOf(document.activeElement as HTMLElement);
      buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      return;
    }
    if (e.repeat) return;
    if (e.key === 'Escape') endTour();
    else if (BACK.has(e.key)) back();
    else next();
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  /** The wheel over an open panel scrolls it, and once it settles the tour shows the section in view. */
  const onWheel = (e: WheelEvent) => {
    const dock = document.querySelector<HTMLElement>('[data-tour="dock"]');
    if (!stop.inside || !stop.tool || !dock || dock.dataset.tool !== stop.tool) return;
    const r = dock.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right) return;
    const scroller = scrollerOf(dock);
    if (!scroller) return;
    scroller.scrollBy({ top: e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY });
    clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => {
      const i = partInView(partsOf(stop), scroller);
      if (i < 0 || i === tourPart()) return;
      followed.current = true;
      setTourPart(i);
    }, 120);
  };

  return createPortal(
    <>
      <div aria-hidden onClick={next} onWheel={onWheel} onContextMenu={e => e.preventDefault()} className={cx('fixed inset-0 z-[1500] cursor-pointer', ENTER)}>
        <svg className="size-full">
          <defs>
            <mask id="takip-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {shot.boxes.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill="black" />)}
            </mask>
          </defs>
          <rect width="100%" height="100%" className="fill-surface-0" fillOpacity={0.6} mask="url(#takip-tour-mask)" />
          {shot.boxes.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill="none" className="stroke-accent" strokeWidth={2} />
          ))}
        </svg>
      </div>
      <TourCard key={`${at}:${part}`} ref={card} stops={stops} at={at} part={part} parts={shot.parts} side={side} onNext={next} onBack={back} />
    </>,
    document.body,
  );
}
