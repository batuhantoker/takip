import Link from 'next/link';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { Muted, TABLE, TD, TH } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsApi } from './analytics-types';
import { bytes, compact, count, pct, shortDay, sum, weekDelta } from './lib/format';
import { ink, NEUTRAL, REFUSED } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { Pair, SectionFrame, Tiles } from './parts/section-frame';

export function ApiSection({ query }: { query: AnalyticsQuery<AnalyticsApi> }) {
  return <SectionFrame query={query}>{p => <Api p={p} />}</SectionFrame>;
}

function Api({ p }: { p: AnalyticsApi }) {
  const requests = p.days.map(d => d.requests);
  const denied = p.days.map(d => d.denied);
  const served = sum(requests);
  const refused = sum(denied);
  const today = p.days[p.days.length - 1];
  const refusedDelta = weekDelta(denied);
  const days = p.days.map(d => d.day);
  const columns = p.days.map(d => ({ key: d.day, label: shortDay(d.day) }));

  return (
    <>
      <p className="text-[12px] text-ink-3">
        Public API (/api/v1 and /api/replay) traffic by UTC day. Per-caller detail is on the <Link href="/admin/usage" className="text-accent hover:underline">Usage page</Link>.
      </p>
      <Tiles>
        <StatTile label="Requests served" value={compact(served)} sub={`${p.days.length} days · ${compact(today?.requests ?? 0)} today`} trend={requests} delta={weekDelta(requests)} />
        <StatTile label="Refused" value={pct(refused, served + refused, 1)} sub={`${count(refused)} rate-limited or over quota`} delta={refusedDelta && { ...refusedDelta, upIsGood: false }} />
        <StatTile label="Data served" value={bytes(sum(p.days.map(d => d.bytes)))} sub="Responses with a declared length" trend={p.days.map(d => d.bytes)} />
        <StatTile label="Callers today" value={count(today?.callers ?? 0)} sub={`${count(today?.keys ?? 0)} API keys among them`} trend={p.days.map(d => d.callers)} />
      </Tiles>

      <ChartCard
        title="Requests per day"
        note="Served and refused"
        table={{ columns: ['Day', 'Served', 'Refused'], rows: [...p.days].reverse().map(d => [d.day, d.requests, d.denied]) }}
      >
        {served + refused ? (
          <StackedBars
            label="API requests per day, served and refused"
            columns={columns}
            series={[
              { key: 'served', label: 'Served', color: NEUTRAL, values: requests },
              { key: 'refused', label: 'Refused', color: REFUSED, values: denied },
            ]}
          />
        ) : <Muted>No API requests in this range.</Muted>}
      </ChartCard>

      <Pair>
        <ChartCard title="Callers per day" note="Distinct accounts, visitors and keys; keys counted on their own too" table={{ columns: ['Day', 'Callers', 'Keys'], rows: [...p.days].reverse().map(d => [d.day, d.callers, d.keys]) }}>
          <TimeSeries
            label="Distinct API callers and keys per day"
            days={days}
            format={count}
            series={[
              { key: 'callers', label: 'Callers', color: ink(0), values: p.days.map(d => d.callers) },
              { key: 'keys', label: 'API keys', color: ink(1), values: p.days.map(d => d.keys) },
            ]}
          />
        </ChartCard>
        <ChartCard title="Data served per day" table={{ columns: ['Day', 'Bytes'], rows: [...p.days].reverse().map(d => [d.day, d.bytes]) }}>
          <TimeSeries label="Bytes served per day" days={days} format={bytes} series={[{ key: 'bytes', label: 'Data served', color: NEUTRAL, values: p.days.map(d => d.bytes) }]} />
        </ChartCard>
      </Pair>

      <Pair>
        <ChartCard title="Route groups" note="Requests in the range; refusals and bytes beneath">
          <BarList
            format={compact}
            empty="No API requests in this range."
            rows={p.groups.map(g => ({ key: g.group, label: g.group, value: g.requests, detail: `${count(g.denied)} refused · ${bytes(g.bytes)}` }))}
          />
        </ChartCard>
        <ChartCard title="API keys">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px] sm:grid-cols-3">
            {([
              ['Issued', p.keys.total],
              ['Active', p.keys.active],
              ['Revoked', p.keys.revoked],
              ['Used in range', p.keys.usedInRange],
              ['Created in range', p.keys.createdInRange],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] text-ink-3">{label}</dt>
                <dd className="font-mono text-[18px] text-ink-1">{count(value)}</dd>
              </div>
            ))}
          </dl>
          <Link href="/admin/keys" className="self-start text-[12px] text-accent hover:underline">All keys</Link>
        </ChartCard>
      </Pair>

      <ChartCard title="Busiest keys" note="By requests in the range">
        {p.topKeys.length ? (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Key</th>
                  <th className={TH}>Owner</th>
                  <th className={`${TH} text-right`}>Requests</th>
                  <th className={`${TH} text-right`}>Refused</th>
                </tr>
              </thead>
              <tbody>
                {p.topKeys.map(k => (
                  <tr key={k.keyId}>
                    <td className={TD}>
                      <span className="text-ink-1">{k.name ?? 'Unnamed key'}</span>
                      {k.prefix && <span className="block font-mono text-[11px] text-ink-3">{k.prefix}…</span>}
                    </td>
                    <td className={`${TD} text-ink-2`}>{k.email ?? '—'}</td>
                    <td className={`${TD} text-right font-mono tabular-nums`}>{count(k.requests)}</td>
                    <td className={`${TD} text-right font-mono tabular-nums ${k.denied ? 'text-red' : 'text-ink-3'}`}>{count(k.denied)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Muted>No key made a request in this range.</Muted>}
      </ChartCard>
    </>
  );
}
