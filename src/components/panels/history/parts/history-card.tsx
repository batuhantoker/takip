import type { ReactNode } from 'react';

/** A feature worth more than a row inside the History panel: wartime borders, the deep-time story. */
export function HistoryCard({ title, body, control, children }: {
  title: string;
  body: ReactNode;
  /** One control at the top right, such as the switch that shows it. */
  control?: ReactNode;
  /** Its actions, in a row under the text. */
  children: ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-ink-1">{title}</p>
          <p className="mt-1 text-small text-ink-2">{body}</p>
        </div>
        {control && <div className="flex h-[18px] shrink-0 items-center">{control}</div>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
