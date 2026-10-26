'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { useMapTalk } from './map-talk';

const WIDE = '(min-width: 1024px)';
const watchWide = (change: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener('change', change);
  return () => mq.removeEventListener('change', change);
};
const isWide = () => window.matchMedia(WIDE).matches;

/**
 * The page's picture of the map that turns into a small live one: on a wide screen the embed loads once the
 * picture is in view; on a phone, where it costs the whole map's code, only when asked. Until it has loaded,
 * the picture is a link into the full map. The embed carries its own "Open the full map".
 *
 * A page with the map beside its list has two: `phone`, the header's, goes live only when asked and only below the
 * wide breakpoint, and `beside`, the tall one by the list, only above it, so the page never runs two maps.
 * Once live, the page's rows can mark places on it (map-talk.ts).
 */
export function LiveWindow({ src, href, image, fallback, alt, cta, explore, badge, mode = 'header' }: {
  /** The embed's URL, /tr/embed/<slug>. */
  src: string;
  /** The full map at this view. */
  href: string;
  image: string | null;
  /** Drawn when there is no picture yet. */
  fallback: ReactNode;
  alt: string;
  cta: string;
  explore: string;
  badge?: string;
  mode?: 'header' | 'phone' | 'beside';
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const wide = useSyncExternalStore(watchWide, isWide, () => false);
  const [asked, setAsked] = useState(false);
  const [ready, setReady] = useState(false);
  const mounted = asked && (mode === 'header' || (mode === 'beside') === wide);
  const [wasMounted, setWasMounted] = useState(mounted);
  if (wasMounted !== mounted) {
    setWasMounted(mounted);
    if (!mounted) setReady(false);
  }
  useMapTalk(frame, mounted);

  useEffect(() => {
    const el = box.current;
    if (!el || mode === 'phone' || !wide) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setAsked(true);
      io.disconnect();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [mode, wide]);

  return (
    <div ref={box} className={cx('relative overflow-hidden rounded-float border border-line bg-surface-1 shadow-float', mode === 'beside' ? 'h-[min(calc(100vh-6rem),40rem)]' : 'aspect-[16/9]')}>
      <a href={href} aria-label={`${cta}: ${alt}`} tabIndex={ready ? -1 : undefined} className={cx('group absolute inset-0 block', FOCUS_RING)}>
        {image
          // eslint-disable-next-line @next/next/no-img-element -- served from .cache by our own route.
          ? <img src={image} alt={alt} fetchPriority={mode === 'beside' ? undefined : 'high'} decoding="async" className="size-full object-cover" />
          : fallback}
      </a>
      {mounted && (
        <iframe ref={frame} src={src} title={alt} onLoad={() => setReady(true)} allow="fullscreen"
          className={cx('absolute inset-0 size-full border-0 transition-opacity duration-150 ease-out motion-reduce:transition-none', ready ? 'opacity-100' : 'opacity-0')} />
      )}
      {!ready && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface-0/90 to-transparent" />
          {badge && (
            <span className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-control border border-line bg-surface-0/80 px-2 py-1 text-[12px] font-medium text-ink-1">
              <span aria-hidden className="size-1.5 rounded-full bg-green" />{badge}
            </span>
          )}
          <div className="absolute right-3 bottom-3 flex gap-2">
            {!mounted && mode !== 'beside' && (
              <button type="button" onClick={() => setAsked(true)}
                className={cx('inline-flex h-9 items-center gap-1.5 rounded-control border border-line-strong bg-surface-0/85 px-3 text-body font-medium text-ink-1 hover:bg-surface-2', FOCUS_RING)}>
                <Play className="size-3.5" aria-hidden />{explore}
              </button>
            )}
            <a href={href} className={cx('inline-flex h-9 items-center gap-1.5 rounded-control bg-accent px-3.5 text-body font-medium text-on-accent hover:bg-accent/90', FOCUS_RING)}>
              {cta}<ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
