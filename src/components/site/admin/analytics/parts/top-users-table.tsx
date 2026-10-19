import Link from 'next/link';
import { TABLE, TD, TH } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsEngagement } from '../analytics-types';
import { minutes, shortDay } from '../lib/format';

export function TopUsersTable({ users, label }: { users: AnalyticsEngagement['topUsers']; label: (feature: string) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>Account</th>
            <th className={`${TH} text-right`}>Map time</th>
            <th className={`${TH} text-right`}>Active days</th>
            <th className={TH}>Last seen</th>
            <th className={TH}>Spends most time in</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.userId} className="hover:bg-surface-2">
              <td className={TD}>
                <Link href={`/admin/users/${u.userId}#activity`} className="block hover:underline">
                  <span className="text-ink-1">{u.email}</span>
                  {u.name && <span className="block text-[11px] text-ink-3">{u.name}</span>}
                </Link>
              </td>
              <td className={`${TD} text-right font-mono tabular-nums`}>{minutes(u.minutes)}</td>
              <td className={`${TD} text-right font-mono tabular-nums`}>{u.activeDays}</td>
              <td className={`${TD} whitespace-nowrap text-ink-2`}>{shortDay(u.lastDay)}</td>
              <td className={`${TD} text-ink-2`}>{u.topFeature ? label(u.topFeature) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
