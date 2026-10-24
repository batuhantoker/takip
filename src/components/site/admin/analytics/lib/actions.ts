/** The panel each counted action belongs to (packages/core/src/usage.ts), in display order, with each action's label. */
const GROUPS: { id: string; label: string; actions: Record<string, string> }[] = [
  { id: 'search', label: 'Search', actions: { 'search.run': 'Queries sent (as typed)', 'search.pick': 'Results picked' } },
  { id: 'alerts', label: 'Alerts', actions: { 'alert.open': 'Alerts opened' } },
  { id: 'route', label: 'Route', actions: { 'route.plan': 'Routes planned', 'route.navigate': 'Navigations started' } },
  { id: 'areas', label: 'Areas', actions: { 'area.draw': 'Areas drawn' } },
  {
    id: 'recon',
    label: 'Recon',
    actions: {
      'recon.email': 'Recon: email', 'recon.domain': 'Recon: domain', 'recon.ip': 'Recon: IP address', 'recon.username': 'Recon: username',
      'recon.phone': 'Recon: phone', 'recon.wallet': 'Recon: wallet', 'recon.cve': 'Recon: CVE', 'recon.sanctions': 'Recon: sanctions', 'recon.other': 'Recon: other',
    },
  },
  { id: 'ti', label: 'TI', actions: { 'ti.ask': 'Questions asked' } },
  { id: 'cameras', label: 'Cameras & feeds', actions: { 'camera.open': 'Cameras opened', 'feed.open': 'Live feeds opened', 'dossier.open': 'Region dossiers opened' } },
  { id: 'history', label: 'History & replay', actions: { 'history.open': 'History opened', 'history.jump': 'Jumps in time', 'replay.start': 'Replays started' } },
  { id: 'space', label: 'Space', actions: { 'space.enter': 'Space view entered', 'space.focus': 'Targets focused' } },
  { id: 'arcgis', label: 'ArcGIS', actions: { 'arcgis.add': 'Layers added' } },
  {
    id: 'sharing',
    label: 'Workspaces & sharing',
    actions: { 'workspace.save': 'Workspaces saved', 'workspace.share': 'Workspaces shared', 'link.share': 'Links shared', 'report.send': 'Issue reports sent' },
  },
  { id: 'map', label: 'Layers & map', actions: { 'layer.on': 'Layers switched on', 'layer.off': 'Layers switched off', 'basemap.change': 'Base map changed' } },
  { id: 'account', label: 'Account', actions: { 'account.sign_up_open': 'Opened sign-up', 'account.sign_in_open': 'Opened sign-in' } },
  {
    id: 'tour',
    label: 'Tour',
    actions: { 'tour.offer': 'Offered on a first visit', 'tour.decline': 'Offer turned down', 'tour.start': 'Tours started', 'tour.inside': 'Looked inside a panel', 'tour.skip': 'Stopped before the end', 'tour.finish': 'Tours finished' },
  },
];

const OTHER = { id: 'other', label: 'Other' };

export const actionLabel = (action: string) => GROUPS.find(g => action in g.actions)?.actions[action] ?? action;

export const actionGroup = (action: string): { id: string; label: string } => GROUPS.find(g => action in g.actions) ?? OTHER;

/** Every action label the groups know, for the test that keeps them in step with USAGE_ACTIONS. */
export const labelledActions = () => GROUPS.flatMap(g => Object.keys(g.actions));

/** Rows grouped by panel, busiest group first, busiest action first within it. */
export function groupActions<T extends { action: string; count: number }>(rows: T[]) {
  const groups = new Map<string, { id: string; label: string; total: number; rows: T[] }>();
  for (const row of rows) {
    const g = actionGroup(row.action);
    const entry = groups.get(g.id) ?? { ...g, total: 0, rows: [] };
    entry.total += row.count;
    entry.rows.push(row);
    groups.set(g.id, entry);
  }
  return [...groups.values()]
    .map(g => ({ ...g, rows: [...g.rows].sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}
