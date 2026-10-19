import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Muted, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { DevicePlace } from '@/components/site/admin/analytics/analytics-types';
import { count } from '@/components/site/admin/analytics/lib/format';
import { accuracyText, deviceText } from '@/components/site/admin/analytics/lib/place';
import { OsmCredit, SharedLabel } from '@/components/site/admin/analytics/parts/place-label';

/** Locations the browser itself reported when the person used theirs on the map: far closer than an IP's guess. */
export default function UserDevicePlaces({ places, who = 'this account' }: { places: DevicePlace[]; who?: string }) {
  return (
    <ChartCard
      title="Shared locations"
      note={`Where ${who} was when using its location on the map (Your location, Use my location, navigation), rounded to about a kilometre`}
      table={places.length ? {
        columns: ['Place', 'Latitude', 'Longitude', 'Accuracy', 'First seen', 'Last seen', 'Fixes'],
        rows: places.map(p => [deviceText(p), p.latitude.toFixed(2), p.longitude.toFixed(2), accuracyText(p.accuracyM), when(p.firstSeenAt), when(p.lastSeenAt), p.fixes]),
      } : null}
    >
      {places.length ? (
        <div className="max-h-96 overflow-auto">
          <table className={TABLE}>
            <thead className="sticky top-0 bg-surface-1">
              <tr>
                <th className={TH}>Place</th>
                <th className={TH}>Seen</th>
                <th className={`${TH} text-right`}>Fixes</th>
              </tr>
            </thead>
            <tbody>
              {places.map(p => (
                <tr key={`${p.latitude},${p.longitude}`}>
                  <td className={TD}>
                    <SharedLabel device={p} />
                    <span className="block font-mono text-[11px] text-ink-3">{p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}</span>
                  </td>
                  <td className={`${TD} whitespace-nowrap text-[12px] text-ink-2`}>
                    {when(p.lastSeenAt)}
                    <span className="block text-[11px] text-ink-3">first {when(p.firstSeenAt)}</span>
                  </td>
                  <td className={`${TD} text-right font-mono tabular-nums`}>{count(p.fixes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Muted>No shared location yet. One is noted only when {who} uses its location on the map, so most stay with the IP&apos;s guess.</Muted>}
      {places.length > 0 && <OsmCredit />}
    </ChartCard>
  );
}
