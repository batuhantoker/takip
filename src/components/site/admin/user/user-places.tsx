import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Muted, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { Place } from '@/components/site/admin/analytics/analytics-types';
import { minutes } from '@/components/site/admin/analytics/lib/format';
import { placeText } from '@/components/site/admin/analytics/lib/place';
import { DbIpCredit, PlaceLabel } from '@/components/site/admin/analytics/parts/place-label';

/** Every address an account or browser used the map from, most recent first, with where it is. */
export default function UserPlaces({ places, who = 'this account' }: { places: Place[]; who?: string }) {
  return (
    <ChartCard
      title="Places"
      note={`Addresses ${who} used the map from, and roughly where they are`}
      table={places.length ? { columns: ['Place', 'IP address', 'First seen', 'Last seen', 'Minutes'], rows: places.map(p => [placeText(p), p.ip, when(p.firstSeenAt), when(p.lastSeenAt), p.minutes]) } : null}
    >
      {places.length ? (
        <div className="max-h-96 overflow-auto">
          <table className={TABLE}>
            <thead className="sticky top-0 bg-surface-1">
              <tr>
                <th className={TH}>Place</th>
                <th className={TH}>Seen</th>
                <th className={`${TH} text-right`}>Map time</th>
              </tr>
            </thead>
            <tbody>
              {places.map(p => (
                <tr key={p.ip}>
                  <td className={TD}><PlaceLabel place={p} ip={p.ip} /></td>
                  <td className={`${TD} whitespace-nowrap text-[12px] text-ink-2`}>
                    {when(p.lastSeenAt)}
                    <span className="block text-[11px] text-ink-3">first {when(p.firstSeenAt)}</span>
                  </td>
                  <td className={`${TD} text-right font-mono tabular-nums ${p.minutes ? '' : 'text-ink-3'}`}>{minutes(p.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Muted>No places recorded yet. They are noted with each map minute, from the release that added them.</Muted>}
      {places.length > 0 && <DbIpCredit />}
    </ChartCard>
  );
}
