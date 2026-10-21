'use client';

import { useState } from 'react';
import { CRAWLER_KIND_LABEL } from '@takip/core/crawlers';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { Button, Muted, when } from '@/components/site/admin/parts/admin-parts';
import { timeAgo } from '@/lib/platform/account/device-label';
import type { AnalyticsCrawlers, CrawlerKind } from './analytics-types';
import { count, longDay, pct, plural, shortDay, sum } from './lib/format';
import { ink, OTHER } from './lib/series';
import { useAnalyticsData } from './lib/use-analytics-data';
import { Pair, SectionFrame, Tiles } from './parts/section-frame';

// A fixed colour per kind, so a kind keeps it whatever else is in range; the rarer kinds share the fold.
const SLOTS: CrawlerKind[] = ['search', 'ai', 'seo', 'preview', 'ads', 'script'];
const kindColor = (kind: CrawlerKind) => (SLOTS.includes(kind) ? ink(SLOTS.indexOf(kind)) : OTHER);
const FOLDED = 'Monitors, archives and other bots';

/** Crawlers and scripts reaching the site's pages, by user agent; `range` is the page's ?days=…, a crawler can be picked to see only its requests. */
export function CrawlersSection({ range }: { range: string }) {
  const [bot, setBot] = useState<string | null>(null);
  const query = useAnalyticsData<AnalyticsCrawlers>(`/analytics/crawlers${range}${bot ? `&bot=${encodeURIComponent(bot)}` : ''}`);
  return (
    <>
      <p className="text-[12px] text-ink-3">
        Requests from crawlers and scripts to the site&apos;s pages, robots.txt and sitemaps, told by the user agent they send. That is a claim, not a check:
        anyone can say they are Googlebot. The web server counts them as they arrive; the map&apos;s data requests and static files aren&apos;t included,
        and none of these are in Pages or Live, which only count browsers that run the page.
      </p>
      {bot && (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-ink-3">Showing</span>
          <span className="font-medium text-ink-1">{bot}</span>
          <Button onClick={() => setBot(null)}>All crawlers</Button>
        </div>
      )}
      <SectionFrame query={query}>{c => <Crawlers c={c} bot={bot} onBot={setBot} />}</SectionFrame>
    </>
  );
}

function Crawlers({ c, bot, onBot }: { c: AnalyticsCrawlers; bot: string | null; onBot: (bot: string) => void }) {
  const kindTotal = (kind: CrawlerKind) => sum(c.daily.map(d => d.kinds[kind]));
  const columns = c.daily.map(d => ({ key: d.day, label: shortDay(d.day), title: longDay(d.day) }));
  const series = [
    ...SLOTS.map(k => ({ key: k, label: CRAWLER_KIND_LABEL[k], color: kindColor(k), values: c.daily.map(d => d.kinds[k]) })),
    { key: 'rest', label: FOLDED, color: OTHER, values: c.daily.map(d => d.kinds.monitor + d.kinds.archive + d.kinds.other) },
  ].filter(s => sum(s.values));

  return (
    <>
      {!c.since
        ? <p className="text-[12px] text-ink-3">No crawler requests recorded yet. They are counted from the web server&apos;s first request after this was added.</p>
        : c.daily[0] && c.since > c.daily[0].day && <p className="text-[12px] text-ink-3">Counting since {longDay(c.since)}.</p>}
      <Tiles>
        <StatTile label="Crawler requests" value={count(c.totals.hits)} sub={bot ? bot : `${count(c.totals.bots)} crawlers and scripts`} />
        <StatTile label="Search engines" value={pct(kindTotal('search'), c.totals.hits)} sub={plural(kindTotal('search'), 'request')} />
        <StatTile label="AI companies" value={pct(kindTotal('ai'), c.totals.hits)} sub={plural(kindTotal('ai'), 'request')} />
        <StatTile label="Pages crawled" value={count(c.totals.pages)} sub={`Different pages, last ${c.pathDays} days`} />
      </Tiles>

      <ChartCard title="Requests per day, by kind of crawler"
        table={{ columns: ['Day', ...series.map(s => s.label)], rows: [...c.daily].reverse().map((d, i) => [d.day, ...series.map(s => s.values[c.daily.length - 1 - i])]) }}>
        {series.length ? <StackedBars label="Crawler requests per day by kind" columns={columns} series={series} /> : <Muted>No crawler requests in this range.</Muted>}
      </ChartCard>

      <Pair>
        <ChartCard title="Crawlers" note="Click one to see only its requests"
          table={c.bots.length ? { columns: ['Crawler', 'Kind', 'Requests', 'Days seen', 'Last day'], rows: c.bots.map(b => [b.bot, CRAWLER_KIND_LABEL[b.kind], b.hits, b.days, b.lastDay]) } : null}>
          <BarList format={count} limit={12} empty="No crawler requests in this range."
            rows={c.bots.map(b => ({
              key: b.bot, value: b.hits, color: kindColor(b.kind),
              label: <button type="button" onClick={() => onBot(b.bot)} className={`hover:underline ${b.bot === bot ? 'font-medium' : ''}`}>{b.bot}</button>,
              detail: `${CRAWLER_KIND_LABEL[b.kind]} · ${b.days} day${b.days === 1 ? '' : 's'} · last ${shortDay(b.lastDay)}`,
            }))} />
        </ChartCard>
        <ChartCard title="What they crawl" note="By section of the site, with the busiest crawlers in each"
          table={c.sections.length ? { columns: ['Section', 'Requests'], rows: c.sections.map(s => [s.section, s.hits]) } : null}>
          <BarList format={count} limit={12} empty="No crawler requests in this range."
            rows={c.sections.map(s => ({
              key: s.section, value: s.hits, label: <span className="font-mono text-[12px]">{s.section}</span>,
              detail: s.bots.map(b => `${b.bot} ${count(b.hits)}`).join(' · '),
            }))} />
        </ChartCard>
      </Pair>

      <Pair>
        <ChartCard title={`Most crawled pages, last ${c.pathDays} days`}
          table={c.paths.length ? { columns: ['Page', 'Requests', 'Crawlers'], rows: c.paths.map(p => [p.path, p.hits, p.bots]) } : null}>
          <BarList format={count} limit={15} share={false} empty="No pages crawled in this window."
            rows={c.paths.map(p => ({
              key: p.path, value: p.hits, label: <span className="font-mono text-[12px]">{p.path}</span>,
              detail: `${p.bots} crawler${p.bots === 1 ? '' : 's'} · last ${timeAgo(new Date(p.lastAt))}`,
            }))} />
        </ChartCard>
        <ChartCard title="Latest requests" note="The last few hundred since the api started">
          {c.recent.length ? (
            <ul className="flex max-h-[28rem] flex-col divide-y divide-line overflow-y-auto">
              {c.recent.map((h, i) => (
                <li key={`${h.at}-${i}`} className="grid grid-cols-[4.5rem_minmax(0,9rem)_minmax(0,1fr)] gap-3 py-1.5 text-[12px]">
                  <span className="text-ink-3" title={when(h.at)}>{timeAgo(new Date(h.at))}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-ink-2">
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: kindColor(h.kind) }} />
                    <span className="truncate">{h.bot}</span>
                  </span>
                  <span className="truncate font-mono text-ink-1" title={h.path}>{h.path}</span>
                </li>
              ))}
            </ul>
          ) : <Muted>None since the api started.</Muted>}
        </ChartCard>
      </Pair>
    </>
  );
}
