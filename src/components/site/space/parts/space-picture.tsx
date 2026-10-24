import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';

/**
 * The page's picture as a window into the 3D view: a photo of the craft or world (whole, on black, since
 * Wikipedia's lead images come in every shape) or a picture of the space view, cropped to fill.
 */
export function SpacePicture({ href, photo, shot, alt, cta, credit }: {
  href: string;
  photo: string | null;
  shot: string | null;
  alt: string;
  cta: string;
  /** Where the photo comes from, under it. */
  credit?: { label: string; href: string } | null;
}) {
  const src = photo ?? shot;
  return (
    <figure>
      <a href={href} aria-label={`${cta}: ${alt}`}
        className={cx('group relative block aspect-[16/9] overflow-hidden rounded-float border border-line bg-black shadow-float', FOCUS_RING)}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- Wikimedia's or our own picture; next/image has no remote patterns here.
          <img src={src} alt={alt} loading="eager" fetchPriority="high" decoding="async"
            className={cx('size-full transition-opacity duration-150 ease-out group-hover:opacity-90 motion-reduce:transition-none', photo ? 'object-contain' : 'object-cover')} />
        )}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 to-transparent" />
        <span className="absolute right-3 bottom-3 inline-flex h-9 items-center gap-1.5 rounded-control bg-accent px-3.5 text-body font-medium text-on-accent">
          {cta}<ArrowUpRight className="size-4" aria-hidden />
        </span>
      </a>
      {photo && credit && (
        <figcaption className="mt-2 text-right text-[12px] text-ink-3">
          <a href={credit.href} rel="noopener" className={cx('hover:text-ink-1', FOCUS_RING)}>{credit.label}</a>
        </figcaption>
      )}
    </figure>
  );
}
