import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';

export interface PageFigure { value: string; label: string; href?: string }

/** What a page leads with: each number large in mono, what it is under it, and the page that explains it. */
export function Figures({ figures }: { figures: PageFigure[] }) {
  return (
    <ul className="mt-8 grid max-w-[40rem] grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
      {figures.map(f => {
        const inner = (
          <>
            <span className="block truncate font-mono text-[26px] leading-8 font-medium tracking-[-0.01em] text-ink-1 tabular-nums">{f.value}</span>
            <span className={cx('mt-1 line-clamp-2 block text-[13px] leading-5 text-ink-3', f.href && 'group-hover:text-ink-1', TRANSITION)}>{f.label}</span>
          </>
        );
        return (
          <li key={`${f.label}-${f.value}`} className="min-w-0 border-t border-line pt-3">
            {f.href ? <Link href={f.href} className={cx('group block', FOCUS_RING)}>{inner}</Link> : inner}
          </li>
        );
      })}
    </ul>
  );
}
