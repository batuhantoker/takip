import type { ReactNode } from 'react';
import { cx, isNumeric } from './class-names';

/** Facts about one thing, label on the left and value on the right: an inspect card's details. */
export function PropertyList({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={cx('flex flex-col', className)}>{children}</dl>;
}

export function Property({ label, value, mono }: {
  label: ReactNode;
  value: ReactNode;
  /** Set in mono; on by default for values that read as numbers. */
  mono?: boolean;
}) {
  return (
    <div className="flex min-h-8 items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-small text-ink-2">{label}</dt>
      <dd className={cx('m-0 min-w-0 truncate text-right text-body text-ink-1', (mono ?? isNumeric(value)) && 'font-mono tabular-nums')}>{value}</dd>
    </div>
  );
}
