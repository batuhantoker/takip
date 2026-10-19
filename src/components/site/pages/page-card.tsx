import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { MapView } from '@/lib/platform/site/map-link';
import { WorldSketch } from './world-sketch';

/** A page in a gallery: its picture, its name and a line about it. */
export function PageCard({ href, image, title, description, points }: {
  href: string;
  image: string | null;
  title: string;
  description: string;
  points?: MapView[];
}) {
  return (
    <Link href={href} className={cx('group flex flex-col overflow-hidden rounded-card border border-line bg-surface-1 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
      <span className="block aspect-[16/9] overflow-hidden border-b border-line">
        {image
          // eslint-disable-next-line @next/next/no-img-element -- see map-window.tsx
          ? <img src={image} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-opacity duration-150 ease-out group-hover:opacity-90 motion-reduce:transition-none" />
          : <WorldSketch points={points} />}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-[15px] font-semibold text-ink-1">{title}</span>
        <span className="line-clamp-2 text-[13px] leading-relaxed text-ink-3">{description}</span>
      </span>
    </Link>
  );
}
