import type { ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';

// Kept apart from site-frame.tsx, which reads the server's files, so client components can import them.

/** The kit's primary and secondary buttons, for links. */
export const LINK_BUTTON = {
  primary: cx('inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-[14px] font-medium text-on-accent hover:bg-accent/90', FOCUS_RING, TRANSITION),
  secondary: cx('inline-flex h-10 items-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 text-[14px] font-medium text-ink-1 hover:bg-surface-3', FOCUS_RING, TRANSITION),
};

export const TEXT_LINK = cx('text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-ink-2', FOCUS_RING);

export function Section({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('mt-12 first:mt-0', className)}>
      <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{title}</h2>
      <div className="mt-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
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
