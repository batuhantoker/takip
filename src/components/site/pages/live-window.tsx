'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';

/**
 * The page's picture of the map that turns into a small live one: on a wide screen the embed loads once the
 * picture is in view; on a phone, where it costs the whole map's code, only when asked. Until it has loaded,
 * the picture is a link into the full map. The embed carries its own "Open the full map".
 */
export function LiveWindow({ src, href, image, fallback, alt, cta, explore, badge }: {
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
}) {
  const box = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || !window.matchMedia('(min-width: 1024px)').matches) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setMounted(true);
      io.disconnect();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className="relative aspect-[16/9] overflow-hidden rounded-float border border-line bg-surface-1 shadow-float">
      <a href={href} aria-label={`${cta}: ${alt}`} tabIndex={ready ? -1 : undefined} className={cx('group absolute inset-0 block', FOCUS_RING)}>
        {image
          // eslint-disable-next-line @next/next/no-img-element -- served from .cache by our own route.
          ? <img src={image} alt={alt} fetchPriority="high" decoding="async" className="size-full object-cover" />
          : fallback}
      </a>
      {mounted && (
        <iframe src={src} title={alt} onLoad={() => setReady(true)} allow="fullscreen"
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
            {!mounted && (
              <button type="button" onClick={() => setMounted(true)}
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
