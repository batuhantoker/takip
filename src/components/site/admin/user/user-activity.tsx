'use client';

import { useState } from 'react';
import { Select } from '@/components/site/admin/parts/admin-parts';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import type { UserAnalytics } from '@/components/site/admin/analytics/analytics-types';
import { featureLabel, splitFeature } from '@/components/site/admin/analytics/lib/features';
import { bytes, compact, count, longDay, minutes, pct, shortDay, sum } from '@/components/site/admin/analytics/lib/format';
import { useAnalyticsData } from '@/components/site/admin/analytics/lib/use-analytics-data';
import { CollectingNote, Pair, SectionFrame, Tiles } from '@/components/site/admin/analytics/parts/section-frame';
import UserActions from './user-actions';
import UserActivityApi from './user-activity-api';
import UserActivityTime from './user-activity-time';
import UserBelongings from './user-belongings';
import UserBrowsers from './user-browsers';
import UserDevicePlaces from './user-device-places';
import UserPlaces from './user-places';
import UserSignIns from './user-sign-ins';

const RANGES = [7, 30, 90] as const;

/** Everything one account did: map time by feature and hour, API traffic, sign-ins, workspaces and reports. */
export default function UserActivity({ id }: { id: string }) {
  const [days, setDays] = useState<number>(30);
  const query = useAnalyticsData<UserAnalytics>(`/analytics/users/${id}?days=${days}`);

  return (
    <section id="activity" className="mt-6 flex scroll-mt-16 flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-1">Activity</h2>
          <p className="text-[12px] text-ink-3">What this account did on the map and the API. Time spent signed out is booked to the browser; see Browsers.</p>
        </div>
        <Select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Activity range">
          {RANGES.map(n => <option key={n} value={n}>Last {n} days</option>)}
        </Select>
      </div>
      <SectionFrame query={query}>{u => <Activity u={u} />}</SectionFrame>
    </section>
  );
}

function Activity({ u }: { u: UserAnalytics }) {
  const { totals } = u;
  const busiest = (kind: string, skip?: string) =>
    u.features.filter(f => splitFeature(f.feature).kind === kind && f.feature !== skip).sort((a, b) => b.minutes - a.minutes)[0] ?? null;
  const panel = busiest('panel', 'panel:none');
  const layer = busiest('layer');
  const phone = u.features.find(f => f.feature === 'device:mobile')?.minutes ?? 0;

  return (
    <>
      <CollectingNote since={u.since} first={u.daily[0]?.day} />
      <Tiles>
        <StatTile label="Map time" value={minutes(totals.minutes)} sub={totals.minutes ? `${u.days} days · ${pct(phone, totals.minutes)} on a phone` : `Last ${u.days} days`} trend={u.daily.map(d => d.minutes)} />
        <StatTile label="Active days" value={count(totals.activeDays)} sub={`${minutes(totals.avgMinutesPerActiveDay)} per active day`} trend={u.daily.map(d => (d.minutes ? 1 : 0))} />
        <StatTile
          label="Last active"
          value={totals.lastActiveDay ? shortDay(totals.lastActiveDay) : 'none'}
          sub={totals.firstActiveDay ? `First seen ${longDay(totals.firstActiveDay)}` : 'No map minutes recorded'}
        />
        <StatTile label="Sign-ins" value={count(totals.signIns)} sub="In the range, from the sign-in log" trend={u.daily.map(d => d.signIns)} />
        <StatTile label="Most used panel" value={panel ? featureLabel(panel.feature) : 'none'} sub={panel ? `${minutes(panel.minutes)} on ${count(panel.days)} days` : 'No panel opened in the range'} />
        <StatTile label="Most used layer" value={layer ? featureLabel(layer.feature) : 'none'} sub={layer ? `${minutes(layer.minutes)} on ${count(layer.days)} days` : 'No layer time in the range'} />
        <StatTile
          label="API requests"
          value={compact(totals.apiRequests)}
          sub={totals.apiDenied ? `${count(totals.apiDenied)} refused · ${pct(totals.apiDenied, totals.apiRequests + totals.apiDenied, 1)}` : 'None refused'}
          trend={u.daily.map(d => d.apiRequests)}
        />
        <StatTile label="API data served" value={bytes(totals.apiBytes)} sub={`${count(u.api.keys.length)} API key${u.api.keys.length === 1 ? '' : 's'} on record`} />
      </Tiles>
      <UserActivityTime u={u} />
      <Pair>
        <UserDevicePlaces places={u.devicePlaces ?? []} />
        <UserPlaces places={u.places} />
      </Pair>
      <UserActions actions={u.actions} />
      <UserActivityApi u={u} />
      <UserSignIns signIns={u.signIns} total={sum(u.daily.map(d => d.signIns))} />
      <UserBrowsers browsers={u.browsers} />
      <UserBelongings u={u} />
    </>
  );
}
