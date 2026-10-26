import type { ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';

// Kept apart from site-frame.tsx, which reads the server's files, so client components can import them.

/** The kit's primary and secondary buttons, for links. */
export const LINK_BUTTON = {
  primary: cx('inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-[14px] font-medium text-on-accent hover:bg-accent/90', FOCUS_RING, TRANSITION),
  secondary: cx('inline-flex h-10 items-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 text-[14px] font-medium text-ink-1 hover:bg-surface-3', FOCUS_RING, TRANSITION),
};

export const TEXT_LINK = cx('text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-ink-2', FOCUS_RING);

/**
 * A reading page's section (docs/design/README.md, Reading pages): a primary one carries the page, with its source or
 * freshness as `meta` beside the title; an `about` one closes it after a hairline, in smaller type.
 */
export function Section({ title, children, className = '', meta, tier = 'primary' }: {
  title: string;
  children: ReactNode;
  className?: string;
  meta?: ReactNode;
  tier?: 'primary' | 'about';
}) {
  const about = tier === 'about';
  return (
    <section className={cx(about ? 'mt-16 border-t border-line pt-8 first:mt-0' : 'mt-14 first:mt-0', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className={about ? 'text-[15px] leading-5 font-semibold text-ink-1' : 'text-[22px] leading-7 font-semibold tracking-[-0.01em] text-ink-1'}>{title}</h2>
        {meta && <p className="text-[11px] leading-[14px] text-ink-3">{meta}</p>}
      </div>
      <div className={about ? 'mt-3 text-[13px] leading-5 text-ink-2' : 'mt-4 text-[15px] leading-relaxed text-ink-2'}>{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-ink-4">
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
}
