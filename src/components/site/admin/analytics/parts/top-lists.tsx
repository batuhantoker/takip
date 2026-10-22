import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { ErrorText } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsEngagement, AnalyticsPages } from '../analytics-types';
import { featureLabel, onByDefault, splitFeature } from '../lib/features';
import { count, minutes, pct, plural } from '../lib/format';
import { originLabel, outcomesBy } from '../lib/journeys';
import type { AnalyticsQuery } from '../lib/use-analytics-data';

const TOP = 5;
const more = (href: string, text: string) => <a href={href} className="text-[11px] text-ink-3 hover:text-ink-1">{text} →</a>;

/** The Overview's three short lists: what was read, what was switched on, and where people came from. */
export function TopLists({ pages, engagement }: {
  pages: AnalyticsQuery<AnalyticsPages>;
  engagement: AnalyticsQuery<AnalyticsEngagement>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="Most read pages" actions={more('#visitors', 'All pages')}>
        {pages.error && !pages.data && <ErrorText message={pages.error} />}
        {pages.data && (
          <BarList format={count} share={false} limit={TOP} empty="No page views in this range yet."
            rows={pages.data.pages.slice(0, TOP).map(p => ({ key: p.path, label: p.path, value: p.views, detail: `${plural(p.readers, 'reader')} · ${count(p.toMap)} went on to the map` }))} />
        )}
      </ChartCard>
      <ChartCard title="Layers people turned on" note="Not counting the ones the map opens with" actions={more('#engagement', 'All layers')}>
        {engagement.error && !engagement.data && <ErrorText message={engagement.error} />}
        {engagement.data && (
          <BarList format={minutes} share={false} limit={TOP} empty="Nobody switched on a layer in this range yet."
            rows={engagement.data.features
              .filter(f => splitFeature(f.feature).kind === 'layer' && !onByDefault(f.feature))
              .sort((a, b) => b.minutes - a.minutes)
              .slice(0, TOP)
              .map(f => ({ key: f.feature, label: featureLabel(f.feature), value: f.minutes, detail: `${plural(f.users, 'account')} · ${plural(f.visitors, 'visitor-day')}` }))} />
        )}
      </ChartCard>
      <ChartCard title="Where visits came from" actions={more('#visitors', 'Visitors')}>
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
