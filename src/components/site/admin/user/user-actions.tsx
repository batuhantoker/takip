import { ChartCard } from '@/components/site/admin/charts/chart-card';
import type { UserAnalytics } from '@/components/site/admin/analytics/analytics-types';
import { actionGroup, actionLabel } from '@/components/site/admin/analytics/lib/actions';
import { count } from '@/components/site/admin/analytics/lib/format';
import { GroupedActions } from '@/components/site/admin/analytics/parts/grouped-actions';

/** What one account or browser did inside the panels: named actions only, never what was typed or looked up. */
export default function UserActions({ actions }: { actions: UserAnalytics['actions'] }) {
  return (
    <ChartCard
      title="Actions"
      note="What they did in each panel; names only, never what was typed or looked up"
      table={actions.length ? { columns: ['Action', 'Panel', 'Count', 'Days'], rows: actions.map(a => [actionLabel(a.action), actionGroup(a.action).label, a.count, a.days]) } : null}
    >
      <GroupedActions rows={actions} detail={a => `on ${count(a.days)} day${a.days === 1 ? '' : 's'}`} empty="No actions counted in this range." />
    </ChartCard>
  );
}
