import type { ReactNode } from 'react';
import { cx, type IconType } from './class-names';

/** What goes here and how to get it there: one icon, two lines, at most one action. */
export function EmptyState({ icon: Icon, title, body, action, className }: {
  icon: IconType;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-10 text-center', className)}>
      <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-surface-2 text-ink-3">
        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
      </span>
      <p className="text-body font-medium text-ink-1">{title}</p>
      {body && <p className="mt-1 max-w-[260px] text-small text-ink-2">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
