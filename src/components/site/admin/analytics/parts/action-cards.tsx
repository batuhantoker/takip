import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Sparkline } from '@/components/site/admin/charts/stat-tile';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsEngagement } from '../analytics-types';
import { actionGroup, actionLabel } from '../lib/actions';
import { count, plural, sum } from '../lib/format';
import { GroupedActions } from './grouped-actions';
import { Pair } from './section-frame';

const NOTE = 'Named actions only, never what was typed or looked up; counted from the release that added them.';

/** What people did inside the panels, and how the busiest actions moved day by day. */
export function ActionCards({ e }: { e: AnalyticsEngagement }) {
  const daily = [...new Set(e.actionDays.flatMap(d => Object.keys(d.counts)))]
    .map(action => ({ action, values: e.actionDays.map(d => d.counts[action] ?? 0) }))
    .map(a => ({ ...a, total: sum(a.values) }))
    .filter(a => a.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <Pair>
      <ChartCard
        title="Actions"
        note={`What people did in each panel. ${NOTE}`}
        table={{
          columns: ['Action', 'Panel', 'Count', 'Accounts', 'Visitors'],
          rows: e.actions.map(a => [actionLabel(a.action), actionGroup(a.action).label, a.count, a.users, a.visitors]),
        }}
      >
        <GroupedActions rows={e.actions} detail={a => `${plural(a.users, 'account')} · ${plural(a.visitors, 'visitor')}`} empty="No actions counted in this range yet." />
      </ChartCard>
      <ChartCard title="Busiest actions per day" note="Each on its own scale; the dot is the last day">
        {daily.length ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
            {daily.map(a => (
              <li key={a.action} className="flex min-w-0 items-center justify-between gap-2 border-b border-line pb-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-ink-1">{actionLabel(a.action)}</div>
                  <div className="font-mono text-[11px] tabular-nums text-ink-3">{count(a.total)}</div>
                </div>
                {a.values.length > 1 && <Sparkline values={a.values} width={96} height={28} />}
              </li>
            ))}
          </ul>
        ) : <Muted>No actions counted in this range yet.</Muted>}
      </ChartCard>
    </Pair>
  );
}
