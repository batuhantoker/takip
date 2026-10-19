import { describeDevice } from '@/lib/platform/account/device-label';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Badge, Muted, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { UserAnalytics } from '@/components/site/admin/analytics/analytics-types';
import { count } from '@/components/site/admin/analytics/lib/format';
import { placeText } from '@/components/site/admin/analytics/lib/place';
import { DbIpCredit, PlaceLabel } from '@/components/site/admin/analytics/parts/place-label';

const isPhone = (ua: string | null) => /Mobi|iPhone|iPod|Android.+Mobile/.test(ua ?? '');

/** The sign-in log, newest first; sign-outs delete Better Auth's session rows, so this is the only full record. */
export default function UserSignIns({ signIns, total }: { signIns: UserAnalytics['signIns']; total: number }) {
  return (
    <ChartCard
      title="Sign-in history"
      note={`${count(total)} in the range. The log keeps the last 90 days (ACTIVITY_RETENTION_DAYS) and starts the day it shipped.`}
      table={signIns.length ? { columns: ['Time', 'Device', 'IP address', 'Place'], rows: signIns.map(s => [when(s.at), describeDevice(s.userAgent), s.ipAddress ?? '', s.ipAddress ? placeText(s.place) : '']) } : null}
    >
      {signIns.length ? (
        <div className="max-h-96 overflow-auto">
          <table className={TABLE}>
            <thead className="sticky top-0 bg-surface-1">
              <tr>
                <th className={TH}>Time</th>
                <th className={TH}>Device</th>
                <th className={TH}>Place</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {signIns.map(s => (
                <tr key={`${s.at}-${s.ipAddress ?? ''}`}>
                  <td className={`${TD} whitespace-nowrap text-ink-2`}>{when(s.at)}</td>
                  <td className={TD}>
                    {describeDevice(s.userAgent)}
                    <span className="block text-[11px] text-ink-3">{isPhone(s.userAgent) ? 'Phone' : 'Desktop or tablet'}</span>
                  </td>
                  <td className={TD}>{s.ipAddress ? <PlaceLabel place={s.place} ip={s.ipAddress} short /> : <span className="text-ink-3">—</span>}</td>
                  <td className={TD}>
                    {s.impersonatedBy && <Badge tone="danger">admin viewing as them{s.impersonatorEmail ? ` · ${s.impersonatorEmail}` : ''}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Muted>No sign-ins recorded since the log started.</Muted>}
      {signIns.some(s => s.place) && <DbIpCredit />}
    </ChartCard>
  );
}
