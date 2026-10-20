import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { MapView } from '@/lib/platform/site/map-link';
import { WorldSketch } from './world-sketch';

/**
 * The page's picture of the map, framed as a window onto it: the whole thing is a link into the full live map,
 * so the picture invites the click rather than standing in for the map.
 */
export function MapWindow({ href, image, alt, cta, badge, points, focus, priority = false, className = '' }: {
  href: string;
  image: string | null;
  alt: string;
  cta: string;
  /** A short label pinned to the corner, such as "Live". */
  badge?: string;
  points?: MapView[];
  /** Without a picture, the sketch centres on this place. */
  focus?: MapView;
  priority?: boolean;
  className?: string;
}) {
  return (
    <a href={href} aria-label={`${cta}: ${alt}`}
      className={cx('group relative block aspect-[16/9] overflow-hidden rounded-float border border-line bg-surface-1 shadow-float', FOCUS_RING, className)}>
      {image
        // eslint-disable-next-line @next/next/no-img-element -- served from .cache by our own route; next/image has no remote patterns here.
        ? <img src={image} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async"
            className="size-full object-cover transition-opacity duration-150 ease-out group-hover:opacity-90 motion-reduce:transition-none" />
        : <WorldSketch points={points} focus={focus} />}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface-0/90 to-transparent" />
      {badge && (
        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-control border border-line bg-surface-0/80 px-2 py-1 text-[12px] font-medium text-ink-1">
          <span aria-hidden className="size-1.5 rounded-full bg-green" />{badge}
        </span>
      )}
      <span className="absolute right-3 bottom-3 inline-flex h-9 items-center gap-1.5 rounded-control bg-accent px-3.5 text-body font-medium text-on-accent">
        {cta}<ArrowUpRight className="size-4" aria-hidden />
      </span>
    </a>
  );
}
