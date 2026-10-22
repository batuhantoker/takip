import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { CohortTable } from '@/components/site/admin/charts/cohort-table';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsPages, AnalyticsVisitors } from '../analytics-types';
import { count } from '../lib/format';
import { More } from './more';
import { TabbedCard } from './tabbed-card';

const LANGUAGE = new Intl.DisplayNames(['en'], { type: 'language' });

/** What's only kept by UTC day: which first-seen weeks came back, and the languages and sections read. */
export function VisitorsMore({ v, p }: { v: AnalyticsVisitors | undefined; p: AnalyticsPages }) {
  const path = (s: string) => <span className="font-mono text-[12px]">{s}</span>;
  return (
    <More id="visitors-by-day" title="Retention and languages" holds="Kept by UTC day, so a window of hours shows the whole days it touches">
      {v && (
        <ChartCard title="Retention by first-seen week" note="Share of each week's new map browsers with map time in the weeks after (weeks start Monday)">
          {v.cohorts.some(c => c.size) ? <CohortTable cohorts={v.cohorts} cohortLabel="First seen (week of)" sizeLabel="Browsers" /> : <Muted>No browsers to follow yet.</Muted>}
        </ChartCard>
      )}
      <TabbedCard title="Reading" tabs={[
        { id: 'languages', label: 'Languages', note: 'The language of the page read', body: (
          <BarList format={count} rows={p.locales.map(l => ({ key: l.locale, label: LANGUAGE.of(l.locale) ?? l.locale, value: l.views }))} empty="No page views in this range." />
        ) },
        { id: 'sections', label: 'Sections', note: '/city, /country, /guides, /map and the rest', body: (
          <BarList format={count} rows={p.sections.map(s => ({ key: s.section, label: path(s.section), value: s.views, detail: `${count(s.readers)} readers` }))} empty="No page views in this range." />
        ) },
      ]} />
    </More>
  );
}
