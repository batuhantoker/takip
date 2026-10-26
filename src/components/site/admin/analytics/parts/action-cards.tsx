import type { BarRow } from '@/components/site/admin/charts/bar-list';
import type { TableView } from '@/components/site/admin/charts/chart-card';
import type { ActionUse } from '../analytics-types';
import { actionGroup, actionLabel } from '../lib/actions';
import { compact, plural } from '../lib/format';

export const ACTIONS_NOTE = 'Named actions only, never what was typed or looked up, counted from the release that added them. The bar is the share of people on the map who took each.';

/** One bar per action, by the people who took it, with its panel, uses and the median uses a person. */
export const actionRows = (actions: ActionUse[]): BarRow[] => actions.map(a => ({
  key: a.action,
  label: actionLabel(a.action),
  value: a.people,
  detail: `${actionGroup(a.action).label} · ${plural(a.count, 'use')} · median ${compact(a.medianUses)} a person`,
}));

export const actionTable = (actions: ActionUse[]): TableView => ({
  columns: ['Action', 'Panel', 'People', 'Uses', 'Median uses', 'Browsers', 'Accounts'],
  rows: actions.map(a => [actionLabel(a.action), actionGroup(a.action).label, a.people, a.count, a.medianUses ?? '—', a.visitors, a.users]),
});
