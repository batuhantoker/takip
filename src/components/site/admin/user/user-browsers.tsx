import Link from 'next/link';
import { describeDevice, timeAgo } from '@/lib/platform/account/device-label';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Muted, when } from '@/components/site/admin/parts/admin-parts';
import type { UserAnalytics } from '@/components/site/admin/analytics/analytics-types';
import { DIRECT_ARRIVAL } from '@/components/site/admin/analytics/lib/features';
import { count, minutes } from '@/components/site/admin/analytics/lib/format';
import { placeShort } from '@/components/site/admin/analytics/lib/place';
import { shortVisitor } from '@/components/site/admin/tables/visitors-table';

/** Browsers (visitor ids) this account signed in on, with how each first arrived and its signed-out time. */
export default function UserBrowsers({ browsers }: { browsers: UserAnalytics['browsers'] }) {
  return (
    <ChartCard title="Browsers" note="Where they signed in, and the time on each browser before or between sign-ins">
      {browsers.length ? (
        <ul className="flex flex-col gap-2 text-[12px]">
          {[...browsers].sort((a, b) => b.lastSeenAt - a.lastSeenAt).map(b => (
            <li key={b.visitorId} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
              <div className="min-w-0">
                <Link href={`/admin/visitors/${b.visitorId}`} className="font-mono text-ink-1 hover:underline" title={b.visitorId}>{shortVisitor(b.visitorId)}</Link>
                <span className="text-ink-2"> · {describeDevice(b.userAgent)}</span>
                <span className="block text-[11px] text-ink-3">
                  First seen {when(b.firstSeenAt)} · last seen <span title={when(b.lastSeenAt)}>{timeAgo(new Date(b.lastSeenAt))}</span>
                </span>
                {b.place && <span className="block text-[11px] text-ink-3">Last at {placeShort(b.place)} · <span className="font-mono">{b.place.ip}</span></span>}
                <span className="block text-[11px] text-ink-3">
                  Arrived from {b.referrer ?? DIRECT_ARRIVAL.toLowerCase()}
                  {b.landing && <> on <span className="font-mono">{b.landing}</span></>}
                </span>
              </div>
              <div className="shrink-0 text-right font-mono tabular-nums">
                <span className={b.minutes ? 'text-ink-1' : 'text-ink-3'}>{minutes(b.minutes)}</span>
                <span className="block text-[11px] text-ink-3">signed out · {count(b.activeDays)} day{b.activeDays === 1 ? '' : 's'}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : <Muted>No browser with a visitor id has signed in to this account yet. A browser gets one the first time it opens the map.</Muted>}
    </ChartCard>
  );
}
