'use client';

import { useState } from 'react';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { Button, ErrorText, Muted } from '@/components/site/admin/parts/admin-parts';
import { timeAgo } from '@/lib/platform/account/device-label';
import type { AnalyticsSearch, SearchData } from './analytics-types';
import { count, longDay, pct, plural, sum } from './lib/format';
import { deviceLabel, pathLabel } from './lib/journeys';
import { countryName, flag } from './lib/place';
import { ink } from './lib/series';
import { useAnalyticsData } from './lib/use-analytics-data';
import { position, SearchTable } from './parts/search-table';
import { Pair, SectionFrame, SectionHeading, Tiles } from './parts/section-frame';

const LANGUAGE = new Intl.DisplayNames(['en'], { type: 'language' });

/** Google Search as Search Console sees it: what showed TAKIP, which kinds of page, where they rank and how often people click. */
export function SearchSection({ range }: { range: string }) {
  const [refreshes, setRefreshes] = useState(0);
  const query = useAnalyticsData<AnalyticsSearch>(`/analytics/search${range}${refreshes ? `&refresh=1&n=${refreshes}` : ''}`);
  return (
    <>
      <p className="text-[12px] text-ink-3">
        Google Search from Search Console: how often TAKIP was shown in results, where, for which searches and how often people clicked. Google&apos;s
        numbers run two to three days behind, and the newest days still change. Searches by term leave out the rare ones Google keeps private, so they add
        up to less than the page totals.
      </p>
      <SectionFrame query={query}>{s => <Search s={s} onRefresh={() => setRefreshes(n => n + 1)} />}</SectionFrame>
    </>
  );
}

function Search({ s, onRefresh }: { s: AnalyticsSearch; onRefresh: () => void }) {
  if (!s.configured) return <Setup />;
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-3">
      <span>
        {s.site ? <>Property <span className="font-mono text-ink-2">{s.site}</span> · </> : null}
        {longDay(s.from)} to {longDay(s.to)} · read from Google {timeAgo(new Date(s.fetchedAt))}
      </span>
      <Button onClick={onRefresh}>Refresh</Button>
    </div>
  );
  if (s.error) return <>{header}<ErrorText message={s.error} /><Muted>Check that the key is the service account&apos;s and the Search Console API is on in its Google Cloud project.</Muted></>;
  if (!s.site || !s.totals) {
    return (
      <>
        {header}
        <section className="flex flex-col gap-2 rounded-card border border-line bg-surface-1 p-4 text-[13px] text-ink-2">
          <h2 className="text-[12px] font-medium text-ink-2">One step left</h2>
          <p>
            The service account <span className="font-mono text-ink-1">{s.account}</span> can&apos;t read any Search Console property yet. In Search Console,
            open takip.dev → Settings → Users and permissions → Add user, give that address Restricted access, then press Refresh.
          </p>
        </section>
      </>
    );
  }
  return <>{header}<Report d={s as SearchData} /></>;
}

function Report({ d }: { d: SearchData }) {
  const [type, setType] = useState<string | null>(null);
  const days = d.daily.map(x => x.day);
  const queries = type ? d.typeQueries.filter(q => q.type === type) : d.queries;
  const pages = type ? d.pages.filter(p => p.type === type) : d.pages;
  const pick = (next: string) => setType(t => (t === next ? null : next));

  return (
    <>
      {d.truncated && <p className="text-[12px] text-amber">Google returned more than 100,000 pages; totals and page types count the first 100,000.</p>}
      <Tiles>
        <StatTile label="Clicks" value={count(d.totals.clicks)} sub="From Google Search to TAKIP" trend={d.daily.map(x => x.clicks)} />
        <StatTile label="Shown in results" value={count(d.totals.impressions)} sub={`${count(d.totals.pages)} pages shown`} trend={d.daily.map(x => x.impressions)} />
        <StatTile label="Click rate" value={pct(d.totals.clicks, d.totals.impressions, 1)} sub="Clicks per time shown" />
        <StatTile label="Average position" value={position(d.totals.position)} sub="1 is the top result" />
      </Tiles>
      <Pair>
        <ChartCard title="Clicks per day" table={{ columns: ['Day', 'Clicks'], rows: [...d.daily].reverse().map(x => [x.day, x.clicks]) }}>
          {sum(d.daily.map(x => x.clicks)) ? <TimeSeries label="Clicks from Google Search per day" days={days} format={count} series={[{ key: 'clicks', label: 'Clicks', color: ink(0), values: d.daily.map(x => x.clicks) }]} />
            : <Muted>No clicks in this range yet.</Muted>}
        </ChartCard>
        <ChartCard title="Times shown per day" table={{ columns: ['Day', 'Shown', 'Average position'], rows: [...d.daily].reverse().map(x => [x.day, x.impressions, position(x.position)]) }}>
          {sum(d.daily.map(x => x.impressions)) ? <TimeSeries label="Times shown in Google Search per day" days={days} format={count} series={[{ key: 'impressions', label: 'Shown', color: ink(1), values: d.daily.map(x => x.impressions) }]} />
            : <Muted>Not shown in this range yet.</Muted>}
        </ChartCard>
      </Pair>

      <SectionHeading>Which kinds of page Google shows</SectionHeading>
      <ChartCard title="Page types" note="Every page added up by what it is. Click one to see its searches and pages below; click again for all">
        <SearchTable head="Page type" rows={d.types} limit={20} selected={r => r.type === type} onPick={r => pick(r.type)}
          label={r => <>{r.type} <span className="text-ink-3">· {plural(r.pages, 'page')}</span></>} />
      </ChartCard>
      {type && (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-ink-3">Showing</span><span className="font-medium text-ink-1">{type}</span>
          <Button onClick={() => setType(null)}>All page types</Button>
        </div>
      )}
      <Pair>
        <ChartCard title={type ? `Searches that showed ${type}` : 'Searches'} note={type ? 'The top 15 for this type' : 'What people typed when Google showed TAKIP'}>
          <SearchTable head="Search" rows={queries} label={q => q.query} empty="No searches Google shares for this yet." />
        </ChartCard>
        <ChartCard title={type ? `${type} pages` : 'Pages'} note="Each opens on takip.dev">
          <SearchTable head="Page" rows={pages} empty="No pages shown in this range."
            label={p => <a href={p.path} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px] hover:underline">{pathLabel(p.path)}</a>} />
        </ChartCard>
      </Pair>

      <SectionHeading>Where</SectionHeading>
      <Pair>
        <ChartCard title="Languages" note="By the page's language">
          <SearchTable head="Language" rows={d.languages} label={l => LANGUAGE.of(l.locale) ?? l.locale} />
        </ChartCard>
        <ChartCard title="Countries" note="Where the searcher was">
          <SearchTable head="Country" rows={d.countries} label={c => (c.country ? <>{flag(c.country)} {countryName(c.country)}</> : 'Unknown')} />
        </ChartCard>
      </Pair>
      <ChartCard title="Devices">
        <SearchTable head="Device" rows={d.devices} label={x => deviceLabel(x.device)} />
      </ChartCard>
    </>
  );
}

function Setup() {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-line bg-surface-1 p-4 text-[13px] text-ink-2">
      <h2 className="text-[12px] font-medium text-ink-2">Connect Search Console</h2>
      <ol className="ml-4 list-decimal space-y-1">
        <li>In Google Cloud Console, pick or create a project and turn on the <span className="text-ink-1">Google Search Console API</span>.</li>
        <li>IAM &amp; Admin → Service accounts → Create a service account (no roles needed), then Keys → Add key → JSON, and download it.</li>
        <li>In Search Console, open takip.dev → Settings → Users and permissions → Add user: the service account&apos;s email, Restricted.</li>
        <li>Put the key on the server, outside the repo, and set <span className="font-mono text-ink-1">GSC_CREDENTIALS</span> to its path in the api&apos;s environment (on the NUC, <span className="font-mono text-ink-1">~/.config/takip/env</span>), then restart the api.</li>
      </ol>
      <p className="text-[12px] text-ink-3">The key only reads: its scope is Search Console read-only.</p>
    </section>
  );
}
