import Link from 'next/link';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { tabHref } from '@/components/site/admin/lib/areas';
import { ErrorText } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsEngagement, AnalyticsPages } from '../analytics-types';
import { featureLabel, onByDefault, splitFeature } from '../lib/features';
import { count, minutes, pct, plural } from '../lib/format';
import { MAP_PATH, originLabel, outcomesBy } from '../lib/journeys';
import type { AnalyticsQuery } from '../lib/use-analytics-data';

const TOP = 5;
const more = (href: string, text: string) => <Link href={href} className="text-[11px] text-ink-3 hover:text-ink-1">{text} →</Link>;

/** The Overview's three short lists: what was read, what was switched on, and where people came from. */
/** `hours`: a window of hours, where the pages come from the visit log and the layers, kept by day, from the last 7 days. */
export function TopLists({ pages, engagement, hours }: {
  pages: AnalyticsQuery<AnalyticsPages>;
  engagement: AnalyticsQuery<AnalyticsEngagement>;
  hours: number | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="Most read pages" actions={more(tabHref('traffic', 'visitors'), 'All pages')}>
        {pages.error && !pages.data && <ErrorText message={pages.error} />}
        {pages.data && (hours ? (
          <BarList format={count} share={false} limit={TOP} empty="No page views in this range yet."
            rows={pages.data.journeys.pages.filter(p => p.path !== MAP_PATH).slice(0, TOP).map(p => ({ key: p.path, label: p.path, value: p.visits, detail: `${count(p.landings)} began here` }))} />
        ) : (
          <BarList format={count} share={false} limit={TOP} empty="No page views in this range yet."
            rows={pages.data.pages.slice(0, TOP).map(p => ({ key: p.path, label: p.path, value: p.views, detail: `${plural(p.readers, 'reader')} · ${count(p.toMap)} went on to the map` }))} />
        ))}
      </ChartCard>
      <ChartCard title="Layers people turned on" note={hours ? 'In the last 7 days: layer time is kept by day' : 'Not counting the ones the map opens with'} actions={more(tabHref('traffic', 'engagement'), 'All layers')}>
        {engagement.error && !engagement.data && <ErrorText message={engagement.error} />}
        {engagement.data && (
          <BarList format={minutes} share={false} limit={TOP} empty="Nobody switched on a layer in this range yet."
            rows={engagement.data.features
              .filter(f => splitFeature(f.feature).kind === 'layer' && !onByDefault(f.feature))
              .sort((a, b) => b.minutes - a.minutes)
              .slice(0, TOP)
              .map(f => ({ key: f.feature, label: featureLabel(f.feature), value: f.minutes, detail: `${plural(f.users, 'account')} · ${plural(f.visitors, 'browser')}` }))} />
        )}
      </ChartCard>
      <ChartCard title="Where visits came from" actions={more(tabHref('traffic', 'visitors'), 'Visitors')}>
        {pages.error && !pages.data && <ErrorText message={pages.error} />}
        {pages.data && (
          <BarList format={count} limit={TOP} empty="No visits in this range yet."
            rows={outcomesBy(pages.data.journeys.flow, 'origin').slice(0, TOP).map(r => ({
              key: r.key, label: originLabel(r.key || null), value: r.visits, detail: `${pct(r.outcomes.map, r.visits)} opened the map`,
            }))} />
        )}
      </ChartCard>
    </div>
  );
}
