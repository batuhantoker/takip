/** The console's areas, in the top bar, and their tabs, each the area page's URL hash (the first is the default). */
export const AREAS = {
  home: { label: 'Home', href: '/admin', tabs: [] },
  traffic: {
    label: 'Traffic', href: '/admin/traffic',
    tabs: [['live', 'Live'], ['visitors', 'Visitors'], ['engagement', 'Engagement'], ['search', 'Search'], ['crawlers', 'Crawlers']],
  },
  accounts: { label: 'Accounts', href: '/admin/accounts', tabs: [['people', 'People'], ['growth', 'Growth'], ['reports', 'Reports'], ['audit', 'Audit log']] },
  api: { label: 'API', href: '/admin/api', tabs: [['traffic', 'Traffic'], ['keys', 'Keys'], ['access', 'Access']] },
  money: { label: 'Money', href: '/admin/money', tabs: [['plans', 'Plans'], ['billing', 'Billing']] },
  data: { label: 'Data', href: '/admin/data', tabs: [['sources', 'Sources'], ['storage', 'Storage & ingest'], ['system', 'System']] },
} as const;

export type AreaId = keyof typeof AREAS;
export type TabOf<A extends AreaId> = (typeof AREAS)[A]['tabs'][number][0];

export const AREA_IDS = Object.keys(AREAS) as AreaId[];

export const tabHref = <A extends AreaId>(area: A, tab: TabOf<A>) => `${AREAS[area].href}#${tab}`;

/** The area a console path belongs to, detail pages included, for the top bar. */
export function areaOf(pathname: string): AreaId {
  if (pathname.startsWith('/admin/users/')) return 'accounts';
  if (pathname.startsWith('/admin/visitors/')) return 'traffic';
  return AREA_IDS.find(id => id !== 'home' && (pathname === AREAS[id].href || pathname.startsWith(`${AREAS[id].href}/`))) ?? 'home';
}

// Pages and Analytics tabs from before the six areas (2026-10-27), so old links and bookmarks still land.
const MOVED: Record<string, string> = {
  '/admin/users': tabHref('accounts', 'people'),
  '/admin/reports': tabHref('accounts', 'reports'),
  '/admin/audit': tabHref('accounts', 'audit'),
  '/admin/plans': tabHref('money', 'plans'),
  '/admin/billing': tabHref('money', 'billing'),
  '/admin/keys': tabHref('api', 'keys'),
  '/admin/usage': tabHref('api', 'traffic'),
  '/admin/sources': tabHref('data', 'sources'),
};
const ANALYTICS: Record<string, string> = {
  live: tabHref('traffic', 'live'),
  visitors: tabHref('traffic', 'visitors'),
  pages: tabHref('traffic', 'visitors'),
  engagement: tabHref('traffic', 'engagement'),
  search: tabHref('traffic', 'search'),
  crawlers: tabHref('traffic', 'crawlers'),
  audience: tabHref('accounts', 'growth'),
  api: tabHref('api', 'traffic'),
  data: tabHref('data', 'storage'),
  system: tabHref('data', 'system'),
};

export function movedTo(pathname: string, hash: string): string {
  if (pathname === '/admin/analytics') return ANALYTICS[hash.replace(/^#/, '')] ?? AREAS.home.href;
  return MOVED[pathname] ?? AREAS.home.href;
}
