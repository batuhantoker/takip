import Link from 'next/link';
import { ArrowDown } from 'lucide-react';
import { describeDevice, timeAgo } from '@/lib/platform/account/device-label';
import { Badge, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { UserList } from '@/components/site/admin/admin-types';
import type { UserSort } from '@/components/site/admin/analytics/analytics-types';
import { featureLabel } from '@/components/site/admin/analytics/lib/features';
import { compact, count, minutes, shortDay } from '@/components/site/admin/analytics/lib/format';
import { WhereLabel } from '@/components/site/admin/analytics/parts/place-label';

const NUM = 'text-right font-mono tabular-nums';
const SUB = 'block text-[11px] text-ink-3';

/** Every account with its activity over the range; the sortable headers ask the api for that order (always descending). */
export default function UsersTable({ list, onSort }: { list: UserList; onSort: (sort: UserSort) => void }) {
  const head = (label: string, sort: UserSort | null, align = '') => (
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
          {head('User', null)}
          {head('Plan', null)}
          {head('Map time', 'minutes', 'text-right')}
          {head('Last active', 'lastActive')}
          {head('Spends time in', null)}
          {head('API requests', 'api', 'text-right')}
          {head('Sign-ins', 'signIns', 'text-right')}
          {head('Last seen', null)}
          {head('Keys · workspaces', null, 'text-right')}
          {head('Joined', 'joined')}
        </tr>
      </thead>
      <tbody>
        {list.users.map(user => {
          const a = user.activity;
          const href = `/admin/users/${user.id}`;
          return (
            <tr key={user.id} className="hover:bg-surface-2">
              <td className={TD}>
                <Link href={href} className="block hover:underline">
                  <span className="text-ink-1">{user.email}</span>
                  <span className={SUB}>{user.name}</span>
                </Link>
              </td>
              <td className={TD}>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={user.plan === 'free' ? 'muted' : 'gold'}>{user.plan}</Badge>
                  {user.role === 'admin' && <Badge tone="gold">admin</Badge>}
                  {user.banned && <Badge tone="danger">banned</Badge>}
                  {!user.emailVerified && <Badge tone="muted">unconfirmed</Badge>}
                  {user.twoFactorEnabled && <Badge tone="muted">2FA</Badge>}
                </div>
              </td>
              <td className={`${TD} ${NUM}`}>
                <Link href={`${href}#activity`} className="hover:underline">{a.minutes ? minutes(a.minutes) : '0 min'}</Link>
                <span className={SUB}>{count(a.activeDays)} active day{a.activeDays === 1 ? '' : 's'}</span>
              </td>
              <td className={`${TD} whitespace-nowrap ${a.lastActiveDay ? 'text-ink-2' : 'text-ink-3'}`}>
                {a.lastActiveDay ? shortDay(a.lastActiveDay) : 'none recorded'}
              </td>
              <td className={TD}>
                {a.topPanel || a.topLayer ? (
                  <>
                    <span className="text-ink-2">{a.topPanel ? `${featureLabel(a.topPanel)} panel` : 'No panel'}</span>
                    {a.topLayer && <span className={SUB}>{featureLabel(a.topLayer)} layer</span>}
                  </>
                ) : <span className="text-ink-3">nothing yet</span>}
              </td>
              <td className={`${TD} ${NUM}`}>
                {compact(a.apiRequests)}
                {a.apiDenied > 0 && <span className="block text-[11px] text-red">{count(a.apiDenied)} refused</span>}
              </td>
              <td className={`${TD} ${NUM} ${a.signIns ? '' : 'text-ink-3'}`}>{count(a.signIns)}</td>
              <td className={`${TD} whitespace-nowrap`}>
                {a.lastSeenAt ? (
                  <>
                    <span className="text-ink-2" title={when(a.lastSeenAt)}>{timeAgo(new Date(a.lastSeenAt))}</span>
                    <span className={SUB}>{describeDevice(a.lastUserAgent)}</span>
                    {(a.lastDevice || a.lastPlace || a.lastIp) && (
                      <span className="mt-0.5 block text-[11px]"><WhereLabel device={a.lastDevice} place={a.lastPlace} ip={a.lastIp} short /></span>
                    )}
                  </>
                ) : <span className="text-ink-3">not seen</span>}
              </td>
              <td className={`${TD} ${NUM} whitespace-nowrap ${a.keys + a.workspaces ? '' : 'text-ink-3'}`}>{count(a.keys)} · {count(a.workspaces)}</td>
              <td className={`${TD} whitespace-nowrap text-ink-3`}>{when(user.createdAt)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
