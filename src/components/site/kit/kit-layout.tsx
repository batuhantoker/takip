import type { ReactNode } from 'react';
import { cx } from '@/components/ui/class-names';

/** One component family on the kit page: name, what it is for, where it lives, its specimens. */
export function KitSection({ id, title, lead, source, children }: {
  id: string;
  title: string;
  lead: ReactNode;
  source?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-10 border-t border-line pt-10 pb-14 first:border-t-0 first:pt-0">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id={`${id}-h`} className="text-title font-semibold text-ink-1">{title}</h2>
        {source && <code className="font-mono text-meta text-ink-3">{source}</code>}
      </div>
      <p className="-mt-4 mb-6 max-w-[60ch] text-body/5 text-ink-2">{lead}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** A framed example with a caption that says what it shows. */
export function Specimen({ caption, children, className, stage = 'p-6', flow = true }: {
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
  stage?: string;
  /** Lay children out as wrapping groups; off for a single block such as a list. */
  flow?: boolean;
}) {
  return (
    <figure className={cx('m-0 overflow-hidden rounded-float border border-line bg-surface-1', className)}>
      <div className={cx(flow && 'flex flex-wrap items-start gap-x-10 gap-y-6', stage)}>{children}</div>
      {caption && <figcaption className="border-t border-line px-4 py-2.5 text-small text-ink-3">{caption}</figcaption>}
    </figure>
  );
}

/** A small name over a group of examples inside a specimen. */
export function Group({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-2.5', className)}>
      <span className="text-meta font-medium text-ink-3">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
