import Link from 'next/link';
import { ArrowDown } from 'lucide-react';
import { describeDevice, timeAgo } from '@/lib/platform/account/device-label';
import { Badge, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { VisitorList, VisitorSort } from '@/components/site/admin/analytics/analytics-types';
import { DIRECT_ARRIVAL, featureLabel } from '@/components/site/admin/analytics/lib/features';
import { count, minutes } from '@/components/site/admin/analytics/lib/format';
import { WhereLabel } from '@/components/site/admin/analytics/parts/place-label';

const NUM = 'text-right font-mono tabular-nums';
const SUB = 'block text-[11px] text-ink-3';

/** Ids are 32 hex characters; the first 8 tell visitors apart in a list. */
export const shortVisitor = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id);

/** Every visitor with their signed-out activity over the range; the sortable headers ask the api for that order (always descending). */
export default function VisitorsTable({ list, onSort }: { list: VisitorList; onSort: (sort: VisitorSort) => void }) {
  const head = (label: string, sort: VisitorSort | null, align = '') => (
    <th className={`${TH} ${align} whitespace-nowrap`} aria-sort={sort && list.sort === sort ? 'descending' : undefined}>
      {sort ? (
        <button type="button" onClick={() => onSort(sort)} className={`inline-flex items-center gap-1 hover:text-ink-1 ${list.sort === sort ? 'text-ink-1' : ''}`}>
          {label}
          {list.sort === sort && <ArrowDown aria-hidden className="size-3" />}
        </button>
      ) : label}
    </th>
  );

  return (
    <table className={TABLE}>
      <thead>
        <tr>
          {head('Visitor', null)}
          {head('Last seen', 'lastSeen')}
          {head('First seen', 'firstSeen')}
          {head('Map time', 'minutes', 'text-right')}
          {head('Active days', 'activeDays', 'text-right')}
          {head('Spends time in', null)}
          {head('Device', null)}
          {head('Last place', null)}
          {head('Arrived from', null)}
          {head('Account', null)}
        </tr>
      </thead>
      <tbody>
        {list.visitors.map(v => (
          <tr key={v.visitorId} className="hover:bg-surface-2">
            <td className={TD}>
              <Link href={`/admin/visitors/${v.visitorId}`} className="font-mono text-[12px] text-ink-1 hover:underline" title={v.visitorId}>{shortVisitor(v.visitorId)}</Link>
              {v.hitWall && <span className="mt-1 block"><Badge tone="danger">hit the limit</Badge></span>}
            </td>
            <td className={`${TD} whitespace-nowrap`}>
              <span className="text-ink-2" title={when(v.lastSeenAt)}>{timeAgo(new Date(v.lastSeenAt))}</span>
            </td>
            <td className={`${TD} whitespace-nowrap text-ink-3`}>{when(v.firstSeenAt)}</td>
            <td className={`${TD} ${NUM} ${v.minutes ? '' : 'text-ink-3'}`}>{minutes(v.minutes)}</td>
            <td className={`${TD} ${NUM} ${v.activeDays ? '' : 'text-ink-3'}`}>{count(v.activeDays)}</td>
            <td className={TD}>
              {v.topPanel || v.topLayer ? (
                <>
                  <span className="text-ink-2">{v.topPanel ? `${featureLabel(v.topPanel)} panel` : 'No panel'}</span>
                  {v.topLayer && <span className={SUB}>{featureLabel(v.topLayer)} layer</span>}
                </>
              ) : <span className="text-ink-3">nothing yet</span>}
            </td>
            <td className={`${TD} whitespace-nowrap text-ink-2`}>{describeDevice(v.userAgent)}</td>
            <td className={`${TD} max-w-56`}><WhereLabel device={v.device} place={v.place} ip={v.place?.ip} short /></td>
            <td className={`${TD} max-w-56`}>
              <span className={v.referrer ? 'text-ink-2' : 'text-ink-3'}>{v.referrer ?? DIRECT_ARRIVAL}</span>
              {v.landing && <span className="block truncate font-mono text-[11px] text-ink-3" title={v.landing}>{v.landing}</span>}
            </td>
            <td className={TD}>
              {v.user ? (
                <>
                  <Link href={`/admin/users/${v.user.id}#activity`} className="text-ink-1 hover:underline">{v.user.email}</Link>
                  {v.linkedAt && <span className={SUB}>signed in {when(v.linkedAt)}</span>}
                </>
              ) : <span className="text-ink-3">never signed in</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
