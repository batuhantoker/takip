'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAdminData } from '@/components/site/admin/admin-api';
import { Button, ErrorText, Muted, when } from '@/components/site/admin/parts/admin-parts';
import { shortVisitor } from '@/components/site/admin/tables/visitors-table';
import { timeAgo } from '@/lib/platform/account/device-label';
import type { PageVisit, PageVisitList, VisitFilter } from '../analytics-types';
import { count, duration } from '../lib/format';
import { CHANNEL_LABEL, deviceLabel, MAP_PATH, NEXT_LABEL, originLabel, pathLabel, STEP_INK } from '../lib/journeys';
import { countryName } from '../lib/place';
import { DbIpCredit, PlaceLabel } from './place-label';

const PAGE = 30;
const LANGUAGE = new Intl.DisplayNames(['en'], { type: 'language' });

function describe(filter: VisitFilter) {
  return [
    filter.origin && ['origin', `from ${filter.origin === 'direct' ? originLabel(null).toLowerCase() : filter.origin}`],
    filter.page && ['page', `through ${pathLabel(filter.page)}`],
    filter.country && ['country', `in ${countryName(filter.country)}`],
    filter.next && ['next', `that ${NEXT_LABEL[filter.next].toLowerCase()}`],
    filter.channel && ['channel', `from ${CHANNEL_LABEL[filter.channel].toLowerCase()}`],
    filter.returning && ['returning', filter.returning === 'new' ? 'from new browsers' : 'from returning browsers'],
  ].filter((x): x is [keyof VisitFilter, string] => !!x);
}

/** The latest visits, each as its trail of pages, narrowed by whatever was picked in the charts above; `tabs` heads the card. */
export function RecentVisits({ range, filter, onFilter, tabs }: { range: string; filter: VisitFilter; onFilter: (f: VisitFilter) => void; tabs: ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [shown, setShown] = useState({ range, filter });
  if (shown.range !== range || shown.filter !== filter) {
    setShown({ range, filter });
    setOffset(0);
  }
  const params = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
  params.set('offset', String(offset));
  params.set('limit', String(PAGE));
  const { data, error, reload } = useAdminData<PageVisitList>(`/analytics/pages/visits${range}&${params}`);
  const chips = describe(filter);

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          {tabs}
          <p className="text-[11px] text-ink-3">Latest first: where each came from, the pages it read in order, and whether it opened the map.</p>
        </div>
        <Button onClick={reload}>Refresh</Button>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-ink-3">Visits</span>
          {chips.map(([key, text]) => (
            <button key={key} type="button" onClick={() => onFilter({ ...filter, [key]: undefined })}
              className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-2.5 text-ink-1 hover:bg-surface-3" aria-label={`Remove: ${text}`}>
              {text}<span aria-hidden className="text-ink-3">×</span>
            </button>
          ))}
          <button type="button" onClick={() => onFilter({})} className="text-accent hover:underline">Show all</button>
        </div>
      )}
      <ErrorText message={error} />
      {data && (
        <>
          {data.visits.length
            ? <ul className="flex flex-col divide-y divide-line">{data.visits.map(v => <VisitRow key={`${v.visitorId}-${v.start}`} v={v} />)}</ul>
            : <Muted>{chips.length ? 'No visits match.' : 'No visits in this range yet.'}</Muted>}
          <div className="flex items-center gap-3 text-[12px] text-ink-3">
            <span>{data.total ? `${offset + 1}–${offset + data.visits.length} of ${count(data.total)}` : '0 visits'}</span>
            <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Newer</Button>
            <Button disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Older</Button>
          </div>
          {data.visits.some(v => v.place) && <DbIpCredit />}
        </>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </section>
  );
}

function VisitRow({ v }: { v: PageVisit }) {
  return (
    <li className="grid gap-x-4 gap-y-1.5 py-3 text-[12px] md:grid-cols-[9rem_14rem_minmax(0,1fr)]">
      <div className="flex flex-col">
        <span className="text-ink-1" title={when(v.end)}>{timeAgo(new Date(v.end))}</span>
        <span className="text-[11px] text-ink-3" title={`Began ${when(v.start)}`}>
          {v.steps.length > 1 ? `${duration(v.end - v.start)} · ` : ''}{v.views} {v.views === 1 ? 'view' : 'views'}
        </span>
        <span className="text-[11px] text-ink-3">{v.returning ? 'Returning' : 'New'}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <PlaceLabel place={v.place} short />
        <span className="text-[11px] text-ink-3">{deviceLabel(v.agent.device)} · {v.agent.os} · {v.agent.browser} · {LANGUAGE.of(v.locale) ?? v.locale}</span>
        <span className="truncate text-[11px]">
          {v.known
            ? <Link href={`/admin/visitors/${v.visitorId}`} className="font-mono text-ink-2 hover:underline" title={v.visitorId}>{shortVisitor(v.visitorId)}</Link>
            : <span className="font-mono text-ink-3" title={`${v.visitorId}: has only read pages, so it has no visitor page`}>{shortVisitor(v.visitorId)}</span>}
          {v.user && <> · <Link href={`/admin/users/${v.user.id}#activity`} className="text-ink-2 hover:underline">{v.user.email}</Link></>}
        </span>
      </div>
      <Trail v={v} />
    </li>
  );
}

const CHIP = 'inline-flex h-6 max-w-full items-center rounded-[6px] border px-2 font-mono text-[11px]';

function Trail({ v }: { v: PageVisit }) {
  return (
    <ol className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="The visit, step by step">
      <li className="inline-flex h-6 min-w-0 items-center gap-1.5 text-ink-2" title={v.origin ? `${v.origin} · ${CHANNEL_LABEL[v.channel]}` : undefined}>
        {v.origin && v.originPath
          ? <a href={`https://${v.origin}${v.originPath}`} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{v.source} <span className="font-mono text-[11px] text-ink-3">{v.originPath}</span></a>
          : originLabel(v.source)}
        {v.campaign && <span className="rounded-[3px] border border-line px-1 text-[10px] uppercase tracking-wide text-ink-3" title="Campaign tag on the link">{v.campaign}</span>}
      </li>
      {v.steps.map((s, i) => (
        <li key={`${s.path}-${s.at}`} className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="text-ink-4">→</span>
          <span title={i ? `+${duration(s.at - v.start)}` : when(s.at)}
            className={`${CHIP} ${s.path === MAP_PATH ? 'text-ink-1' : 'border-line text-ink-1'}`}
            style={s.path === MAP_PATH ? { borderColor: STEP_INK.map } : undefined}>
            <span className="truncate">{pathLabel(s.path)}</span>
          </span>
        </li>
      ))}
      {v.next === 'left' && <li className="inline-flex h-6 items-center gap-1.5 text-ink-3"><span aria-hidden className="text-ink-4">→</span>left</li>}
    </ol>
  );
}
