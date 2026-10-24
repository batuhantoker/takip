'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, ENTER } from '@/components/ui/class-names';
import { Kbd } from '@/components/ui/kbd';
import { ENTER_FROM, place, type Align, type Side } from '@/components/ui/position';
import { useT } from '@/components/ui/use-t';
import { showSettingsTab } from '@/components/shell/settings/open-settings';
import { STOPS, type Stop } from '../lib/stops';
import { endTour, stepTour } from '../tour-state';

type Box = { x: number; y: number; w: number; h: number };

const PAD = 4;
const IGNORED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn']);

function onScreen(el: Element): Box | null {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null;
  if (getComputedStyle(el).visibility === 'hidden') return null;
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

/** What draws a box: a Popover's trigger sits in a display: contents wrapper, which has none. */
function drawn(el: Element): Element[] {
  return getComputedStyle(el).display === 'contents' ? [...el.children].flatMap(drawn) : [el];
}

/** Every target on screen, the card's anchor first. */
function measure(stop: Stop): { boxes: Box[]; anchor: Element | null } {
  const boxes: Box[] = [];
  let anchor: Element | null = null;
  for (const selector of stop.targets) {
    for (const el of [...document.querySelectorAll(selector)].flatMap(drawn)) {
      const box = onScreen(el);
      if (!box) continue;
      anchor ??= el;
      boxes.push(box);
    }
  }
  return { boxes, anchor };
}

const same = (a: Box[], b: Box[]) => a.length === b.length && a.every((x, i) => x.x === b[i].x && x.y === b[i].y && x.w === b[i].w && x.h === b[i].h);

/** The dimmed screen with each target ringed, and the card beside the first. Any key or click goes on. */
export function TourLayer({ at }: { at: number }) {
  const t = useT();
  const stop = STOPS[at];
  const last = at === STOPS.length - 1;
  const id = useId();
  const card = useRef<HTMLDivElement>(null);
  const [shot, setShot] = useState<{ boxes: Box[]; anchor: Element | null }>({ boxes: [], anchor: null });
  // An open panel stands in for its sidebar entry, so the card goes beside it.
  const docked = !!shot.anchor?.matches('[data-tour="dock"]');
  const side: Side | undefined = docked ? 'right' : stop.side;
  const align: Align = docked ? 'start' : stop.align ?? 'center';

  // Panels fade in and pieces slide as the dock opens, so the rings keep up. Layout, so a new stop never paints the last one's rings.
  useLayoutEffect(() => {
    const look = () => setShot(prev => {
      const next = measure(stop);
      return same(prev.boxes, next.boxes) && prev.anchor === next.anchor ? prev : next;
    });
    look();
    const timer = setInterval(look, 120);
    window.addEventListener('resize', look);
    return () => { clearInterval(timer); window.removeEventListener('resize', look); };
  }, [stop]);

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
  }, [shot, side, align]);

  useEffect(() => {
    card.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, [at]);

  // Capture on window runs before the map's keys, the shortcuts and Escape's stack, so none of them fire underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') stepTour(-1);
      else stepTour(1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const openLayout = () => { endTour(); showSettingsTab('layout'); };

  return createPortal(
    <>
      <div aria-hidden onClick={() => stepTour(1)} onContextMenu={e => e.preventDefault()} className={cx('fixed inset-0 z-[1500] cursor-pointer', ENTER)}>
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
      <div key={at} ref={card} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`}
        style={{ visibility: 'hidden' }}
        className={cx('fixed top-0 left-0 z-[1501] w-[320px] rounded-float border border-line bg-surface-1 p-4 shadow-float', ENTER, side && ENTER_FROM[side])}>
        <div className="-mt-1 -mr-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-meta font-medium text-ink-3 tabular-nums">{t('{n} of {count}', { n: at + 1, count: STOPS.length })}</p>
          <IconButton size="sm" label={t('Stop the tour')} kbd="Esc" icon={X} onClick={endTour} />
        </div>
        <h2 id={`${id}-title`} className="mt-1 flex items-center gap-2 text-title font-semibold text-ink-1">
          {t(stop.title)}
          {stop.kbd && <Kbd>{stop.kbd}</Kbd>}
        </h2>
        <p id={`${id}-body`} className="mt-1.5 text-body text-ink-2">{t(stop.body)}</p>
        {stop.id === 'layout' && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={openLayout}>{t('Open Layout settings')}</Button>
        )}
        <div className="mt-4 flex items-center gap-1">
          <p className="min-w-0 flex-1 text-meta text-ink-3">{t('Any key or click goes on')}</p>
          {at > 0 && <Button variant="ghost" size="sm" onClick={() => stepTour(-1)}>{t('Back')}</Button>}
          <Button variant="primary" size="sm" data-autofocus onClick={() => stepTour(1)}>{last ? t('Done') : t('Next')}</Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
