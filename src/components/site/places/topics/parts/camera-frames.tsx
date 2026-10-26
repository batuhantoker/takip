'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { freshen } from '@/lib/feeds/cameras/preview';

/** A camera's latest picture, captioned, leading to it on the map. */
export interface CameraFrame { key: string; name: string; src: string; href: string; meta: string }

/** Kinder to the camera owners and to a phone's data than the map tiles' 15 s. */
const REFRESH_MS = 60_000;

/**
 * Camera stills in a grid, `show` at a time; one that fails to load gives its place to the next. The pictures come
 * straight from each camera's owner, as the map's tiles do. They are asked for again every minute while the grid is on
 * screen, and a new picture replaces the old only once it has loaded.
 */
export function CameraFrames({ frames, show, empty, className, eager = true }: {
  frames: CameraFrame[];
  show: number;
  /** Said when none of them sends a picture. */
  empty: string;
  className?: string;
  /** Below the first screen, the pictures wait until they are near it. */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [tick, setTick] = useState(0);
  const box = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let seen = false;
    const io = new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; });
    io.observe(el);
    const timer = setInterval(() => {
      if (seen && document.visibilityState === 'visible') setTick(n => n + 1);
    }, REFRESH_MS);
    return () => {
      clearInterval(timer);
      io.disconnect();
    };
  }, []);

  const fail = useCallback((key: string) => setFailed(prev => new Set(prev).add(key)), []);
  const shown = frames.filter(f => !failed.has(f.key)).slice(0, show);
  if (!shown.length) return <p className="rounded-card border border-line bg-surface-1 p-4 text-[14px] text-ink-2">{empty}</p>;
  return (
    <ul ref={box} className={cx('grid gap-3', shown.length > 1 && 'grid-cols-2', className)}>
      {shown.map(f => (
        <li key={f.key} className="min-w-0">
          <a href={f.href} className={cx('group block', FOCUS_RING)}>
            <span className="block aspect-video overflow-hidden rounded-card border border-line bg-surface-2 group-hover:border-line-strong">
              <Still id={f.key} src={f.src} alt={f.name} tick={tick} eager={eager} onFail={fail} />
            </span>
            <span className={cx('mt-1.5 block truncate text-[13px] font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{f.name}</span>
            <span className="block truncate text-[12px] text-ink-3">{f.meta}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Still({ id, src, alt, tick, eager, onFail }: { id: string; src: string; alt: string; tick: number; eager: boolean; onFail: (id: string) => void }) {
  const ref = useRef<HTMLImageElement>(null);
  const [shown, setShown] = useState(src);

  // An eager picture can fail before hydration, when React isn't listening yet.
  useEffect(() => {
    const el = ref.current;
    if (eager && el?.complete && el.naturalWidth === 0) onFail(id);
  }, [eager, id, onFail]);

  useEffect(() => {
    if (!tick) return;
    const next = freshen(src);
    const probe = new Image();
    probe.onload = () => setShown(next);
    probe.src = next;
    return () => { probe.onload = null; };
  }, [tick, src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote camera frames, no loader
    <img ref={ref} src={shown} alt={alt} width={320} height={180} loading={eager ? 'eager' : 'lazy'} decoding="async"
      onError={() => onFail(id)} className="size-full object-cover" />
  );
}
