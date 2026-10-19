'use client';

import { useState } from 'react';
import Link from 'next/link';
import { describeDevice, timeAgo } from '@/lib/platform/account/device-label';
import { Card, PageTitle, Select, when } from '@/components/site/admin/parts/admin-parts';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import type { VisitorAnalytics } from '@/components/site/admin/analytics/analytics-types';
import { DIRECT_ARRIVAL, featureLabel, splitFeature } from '@/components/site/admin/analytics/lib/features';
import { count, longDay, minutes, pct, shortDay } from '@/components/site/admin/analytics/lib/format';
import { useAnalyticsData } from '@/components/site/admin/analytics/lib/use-analytics-data';
import { CollectingNote, SectionFrame, Tiles } from '@/components/site/admin/analytics/parts/section-frame';
import { shortVisitor } from '@/components/site/admin/tables/visitors-table';
import UserActivityTime from '@/components/site/admin/user/user-activity-time';

const RANGES = [7, 30, 90] as const;

/** One browser's signed-out activity, from the visitor id it keeps in localStorage. */
export default function VisitorPage({ id }: { id: string }) {
  const [days, setDays] = useState<number>(30);
  const query = useAnalyticsData<VisitorAnalytics>(`/analytics/visitors/${encodeURIComponent(id)}?days=${days}`);
  const missing = query.error === 'not_found';

  return (
    <>
      <Link href="/admin/analytics#visitors" className="mb-3 inline-block text-[12px] text-ink-3 hover:text-ink-1">← Visitors</Link>
      <PageTitle title={`Visitor ${shortVisitor(id)}`}>
        <Select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Activity range">
          {RANGES.map(n => <option key={n} value={n}>Last {n} days</option>)}
        </Select>
      </PageTitle>
      {missing ? (
        <p className="text-[13px] text-ink-3">No visitor with this id. It may never have opened the map, or it went with the retention window or a deleted account.</p>
      ) : (
        <SectionFrame query={query}>{v => <Visitor v={v} />}</SectionFrame>
      )}
    </>
  );
}

function Visitor({ v }: { v: VisitorAnalytics }) {
  const { visitor, totals } = v;
  const busiest = (kind: string, skip?: string) =>
    v.features.filter(f => splitFeature(f.feature).kind === kind && f.feature !== skip).sort((a, b) => b.minutes - a.minutes)[0] ?? null;
  const panel = busiest('panel', 'panel:none');
  const layer = busiest('layer');
  const phone = v.features.find(f => f.feature === 'device:mobile')?.minutes ?? 0;

  return (
    <>
      <Card title="Browser">
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-[12px]">
          <dt className="text-ink-3">Visitor id</dt><dd className="break-all font-mono text-[11px]">{visitor.visitorId}</dd>
          <dt className="text-ink-3">First seen</dt><dd>{when(visitor.firstSeenAt)}</dd>
          <dt className="text-ink-3">Last seen</dt><dd>{when(visitor.lastSeenAt)} <span className="text-ink-3">· {timeAgo(new Date(visitor.lastSeenAt))}</span></dd>
          <dt className="text-ink-3">Device</dt>
          <dd>
            {describeDevice(visitor.userAgent)}
            {visitor.userAgent && <span className="block break-all font-mono text-[11px] text-ink-3">{visitor.userAgent}</span>}
          </dd>
          <dt className="text-ink-3">Arrived from</dt><dd className={visitor.referrer ? '' : 'text-ink-3'}>{visitor.referrer ?? DIRECT_ARRIVAL}</dd>
          <dt className="text-ink-3">Landed on</dt><dd className="break-all font-mono text-[11px]">{visitor.landing ?? '—'}</dd>
          <dt className="text-ink-3">Account</dt>
          <dd>
            {visitor.user ? (
              <>
                <Link href={`/admin/users/${visitor.user.id}#activity`} className="text-accent hover:underline">{visitor.user.email}</Link>
                <span className="text-ink-3"> · {visitor.user.name}{visitor.linkedAt ? ` · signed in here ${when(visitor.linkedAt)}` : ''}</span>
              </>
            ) : <span className="text-ink-3">Never signed in on this browser</span>}
          </dd>
        </dl>
      </Card>

      <CollectingNote since={v.since} first={v.daily[0]?.day} />
      <Tiles>
        <StatTile label="Map time signed out" value={minutes(totals.minutes)} sub={totals.minutes ? `${v.days} days · ${pct(phone, totals.minutes)} on a phone` : `Last ${v.days} days`} trend={v.daily.map(d => d.minutes)} />
        <StatTile label="Active days" value={count(totals.activeDays)} sub={`${minutes(totals.avgMinutesPerActiveDay)} per active day`} trend={v.daily.map(d => (d.minutes ? 1 : 0))} />
        <StatTile
          label="Last active"
          value={totals.lastActiveDay ? shortDay(totals.lastActiveDay) : 'none'}
          sub={totals.firstActiveDay ? `First active ${longDay(totals.firstActiveDay)}` : 'No signed-out map minutes recorded'}
        />
        <StatTile label="Hit the time limit" value={count(totals.wallDays)} sub={`day${totals.wallDays === 1 ? '' : 's'} in the range`} />
        <StatTile label="Most used panel" value={panel ? featureLabel(panel.feature) : 'none'} sub={panel ? `${minutes(panel.minutes)} on ${count(panel.days)} days` : 'No panel opened in the range'} />
        <StatTile label="Most used layer" value={layer ? featureLabel(layer.feature) : 'none'} sub={layer ? `${minutes(layer.minutes)} on ${count(layer.days)} days` : 'No layer time in the range'} />
      </Tiles>
      <UserActivityTime u={v} who="This visitor" />
    </>
  );
}
