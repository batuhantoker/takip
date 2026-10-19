import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { Badge, Muted, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { UserAnalytics } from '@/components/site/admin/analytics/analytics-types';
import { bytes, compact, count, shortDay } from '@/components/site/admin/analytics/lib/format';
import { NEUTRAL, REFUSED } from '@/components/site/admin/analytics/lib/series';
import { Pair } from '@/components/site/admin/analytics/parts/section-frame';

const NUM = 'text-right font-mono tabular-nums';

/** This account's /api/v1 and /api/replay traffic: per day, per route group, and per key. */
export default function UserActivityApi({ u }: { u: UserAnalytics }) {
  const { api } = u;
  const any = u.daily.some(d => d.apiRequests + d.apiDenied > 0);
  const keys = [...api.keys].sort((a, b) => Number(a.revokedAt != null) - Number(b.revokedAt != null) || b.requests - a.requests);

  return (
    <>
      <Pair>
        <ChartCard
          title="API requests per day"
          note="Served and refused, from their session and their keys"
          table={any ? { columns: ['Day', 'Served', 'Refused'], rows: [...u.daily].reverse().map(d => [d.day, d.apiRequests, d.apiDenied]) } : null}
        >
          {any ? (
            <StackedBars
              label="This account's API requests per day, served and refused"
              columns={u.daily.map(d => ({ key: d.day, label: shortDay(d.day) }))}
              series={[
                { key: 'served', label: 'Served', color: NEUTRAL, values: u.daily.map(d => d.apiRequests) },
                { key: 'refused', label: 'Refused', color: REFUSED, values: u.daily.map(d => d.apiDenied) },
              ]}
            />
          ) : <Muted>No API requests in this range.</Muted>}
        </ChartCard>
        <ChartCard title="Route groups" note="Requests in the range; refusals and bytes beneath">
          <BarList
            rows={api.groups.map(g => ({
              key: g.group,
              label: <span className="font-mono text-[12px]">{g.group}</span>,
              value: g.requests,
              detail: `${g.denied ? `${count(g.denied)} refused · ` : ''}${bytes(g.bytes)}`,
            }))}
            empty="No API requests in this range."
          />
        </ChartCard>
      </Pair>

      <ChartCard title="API keys" note="Every key they have had, with its traffic in the range">
        {keys.length ? (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Key</th>
                  <th className={`${TH} text-right`}>Requests</th>
                  <th className={`${TH} text-right`}>Refused</th>
                  <th className={`${TH} text-right`}>Data</th>
                  <th className={TH}>Last used</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.keyId} className={k.revokedAt ? 'text-ink-3' : ''}>
                    <td className={TD}>
                      <span className={k.revokedAt ? '' : 'text-ink-1'}>{k.name ?? 'Unnamed key'}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-3">{k.prefix ?? k.keyId}</span>
                      {k.revokedAt && <span className="ml-2"><Badge tone="muted">revoked {when(k.revokedAt)}</Badge></span>}
                    </td>
                    <td className={`${TD} ${NUM}`}>{compact(k.requests)}</td>
                    <td className={`${TD} ${NUM} ${k.denied ? 'text-red' : 'text-ink-3'}`}>{count(k.denied)}</td>
                    <td className={`${TD} ${NUM}`}>{bytes(k.bytes)}</td>
                    <td className={`${TD} whitespace-nowrap text-ink-3`}>{k.lastUsedAt ? when(k.lastUsedAt) : 'never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Muted>They have never made an API key.</Muted>}
      </ChartCard>
    </>
  );
}
