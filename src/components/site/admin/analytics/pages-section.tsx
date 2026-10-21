import { useRef, useState } from 'react';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsPages, VisitFilter } from './analytics-types';
import { DIRECT_ARRIVAL } from './lib/features';
import { count, longDay, pct, sinceIndex, sum, weekDelta } from './lib/format';
import { ink } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { PageDetail } from './parts/page-detail';
import { PageJourneys } from './parts/page-journeys';
import { RecentVisits } from './parts/recent-visits';
import { Pair, SectionFrame, SectionHeading, Tiles } from './parts/section-frame';

const LANGUAGE = new Intl.DisplayNames(['en'], { type: 'language' });

/** `range` is the page's ?days=…[&admins=exclude], for the recent visits' own requests. */
export function PagesSection({ query, range }: { query: AnalyticsQuery<AnalyticsPages>; range: string }) {
  const [filter, setFilter] = useState<VisitFilter>({});
  const list = useRef<HTMLDivElement>(null);
  const pick = (next: VisitFilter) => {
    setFilter(next);
    list.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <>
      <p className="text-[12px] text-ink-3">
        The public pages off the map: the layer pages, places, events, guides and About. Each view is counted once as the page opens, with its language and
        the site that sent the reader; readers are browsers by their visitor id. Views and map openings are also logged one by one, which is what the visits
        below are made of. Crawlers don&apos;t run the script that reports a view, so none of this is bots.
      </p>
      <SectionFrame query={query}>{p => <Pages p={p} onPick={pick} />}</SectionFrame>
      <div ref={list} className="flex scroll-mt-4 flex-col gap-4">
        {filter.page && <PageDetail range={range} path={filter.page} onClose={() => setFilter({ ...filter, page: undefined })} />}
        <RecentVisits range={range} filter={filter} onFilter={setFilter} />
      </div>
      <SectionFrame query={query}>{p => <Totals p={p} />}</SectionFrame>
    </>
  );
}

function Pages({ p, onPick }: { p: AnalyticsPages; onPick: (filter: VisitFilter) => void }) {
  const { totals, daily } = p;
  const days = daily.map(d => d.day);
  const from = sinceIndex(daily, p.since);
  const series = (key: 'views' | 'readers') => daily.map(d => d[key]);
  const topReferrer = p.referrers.find(r => r.referrer);

  return (
    <>
      {!p.since
        ? <p className="text-[12px] text-ink-3">No page views recorded yet. They are counted from the first public page opened after this was added.</p>
        : days[0] && p.since > days[0] && <p className="text-[12px] text-ink-3">Counting since {longDay(p.since)}; earlier days have no page views.</p>}
      <Tiles>
        <StatTile label="Page views" value={count(totals.views)} trend={series('views')} delta={weekDelta(series('views'), from)} />
        <StatTile label="Readers" value={count(totals.readers)} sub="Browsers, by visitor id" trend={series('readers')} delta={weekDelta(series('readers'), from)} />
        <StatTile label="Went on to the map" value={count(totals.toMap)} sub={`${pct(totals.toMap, totals.readers)} of readers`} />
        <StatTile label="Pages read" value={count(totals.pages)} sub="Different pages" />
        <StatTile label="Top referrer" value={topReferrer?.referrer ?? 'none'} sub={topReferrer ? `${count(topReferrer.views)} views` : 'Every view was direct or hidden'} />
      </Tiles>

      <ChartCard title="Views and readers per day" table={{ columns: ['Day', 'Views', 'Readers'], rows: [...daily].reverse().map(d => [d.day, d.views, d.readers]) }}>
        {sum(series('views')) ? (
          <TimeSeries label="Public page views and readers per day" days={days} format={count} series={[
            { key: 'views', label: 'Views', color: ink(0), values: series('views') },
            { key: 'readers', label: 'Readers', color: ink(1), values: series('readers') },
          ]} />
        ) : <Muted>No page views in this range.</Muted>}
      </ChartCard>

      <SectionHeading>Visits</SectionHeading>
      <PageJourneys j={p.journeys} first={days[0]} onPick={onPick} />
    </>
  );
}

function Totals({ p }: { p: AnalyticsPages }) {
  const path = (s: string) => <span className="font-mono text-[12px]">{s}</span>;
  return (
    <>
      <SectionHeading>Which pages</SectionHeading>
      <ChartCard title="Pages" note="Most viewed first, by English path; the share of readers who went on to the map in each"
        table={p.pages.length ? { columns: ['Page', 'Views', 'Readers', 'Went on to the map'], rows: p.pages.map(x => [x.path, x.views, x.readers, x.toMap]) } : null}>
        <BarList format={count} limit={20}
          rows={p.pages.map(x => ({ key: x.path, label: path(x.path), value: x.views, detail: `${count(x.readers)} readers · ${pct(x.toMap, x.readers)} to the map` }))}
          empty="No page views in this range." />
      </ChartCard>
      <Pair>
        <ChartCard title="Sections" note="/city, /country, /guides, /map and /about">
          <BarList format={count} rows={p.sections.map(s => ({ key: s.section, label: path(s.section), value: s.views, detail: `${count(s.readers)} readers` }))} empty="No page views in this range." />
        </ChartCard>
        <ChartCard title="Languages" note="The language of the page read">
          <BarList format={count} rows={p.locales.map(l => ({ key: l.locale, label: LANGUAGE.of(l.locale) ?? l.locale, value: l.views }))} empty="No page views in this range." />
        </ChartCard>
      </Pair>

      <SectionHeading>Who sent them</SectionHeading>
      <ChartCard title="Referrers" note="The other site the view came from; search engines show here once people find the pages">
        <BarList format={count} limit={15}
          rows={p.referrers.map(r => ({ key: r.referrer ?? '', label: r.referrer ?? DIRECT_ARRIVAL, value: r.views, detail: `${count(r.readers)} readers` }))}
          empty="No page views in this range." />
      </ChartCard>
    </>
  );
}
