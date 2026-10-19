import type { ReactNode } from 'react';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { actionLabel, groupActions } from '../lib/actions';
import { count } from '../lib/format';

/** Counted actions under the panel they belong to; every bar shares one scale so groups compare. */
export function GroupedActions<T extends { action: string; count: number }>({ rows, detail, empty }: { rows: T[]; detail: (row: T) => ReactNode; empty: string }) {
  if (!rows.length) return <p className="text-[12px] text-ink-3">{empty}</p>;
  const max = Math.max(...rows.map(r => r.count));
  return (
    <div className="flex flex-col gap-4">
      {groupActions(rows).map(group => (
        <div key={group.id} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1 text-[11px] font-medium text-ink-3">
            <span>{group.label}</span>
            <span className="font-mono tabular-nums">{count(group.total)}</span>
          </div>
          <BarList format={count} share={false} max={max} limit={6} rows={group.rows.map(r => ({ key: r.action, label: actionLabel(r.action), value: r.count, detail: detail(r) }))} />
        </div>
      ))}
    </div>
  );
}
