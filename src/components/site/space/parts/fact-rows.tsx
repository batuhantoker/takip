import type { ReactNode } from 'react';

export type FactRow = { label: string; value: ReactNode };

/** Facts as a two-column table, the label beside its value (above it on a phone). */
export function FactRows({ rows }: { rows: FactRow[] }) {
  return (
    <dl className="divide-y divide-line rounded-card border border-line bg-surface-1">
      {rows.map(r => (
        <div key={r.label} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:gap-6">
          <dt className="text-[13px] text-ink-3 sm:w-40 sm:flex-shrink-0">{r.label}</dt>
          <dd className="text-[14px] leading-relaxed text-ink-1 [overflow-wrap:anywhere]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
