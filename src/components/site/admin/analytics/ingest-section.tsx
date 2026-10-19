import { useState } from 'react';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { Badge, Muted, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsData } from './analytics-types';
import { bytes, compact, count, shortDay, sum } from './lib/format';
import { ink, NEUTRAL, REFUSED } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { Pair, SectionFrame, SectionHeading, Tiles } from './parts/section-frame';

export function IngestSection({ query }: { query: AnalyticsQuery<AnalyticsData> }) {
  return (
    <>
      <SectionHeading>Data accumulation</SectionHeading>
      <SectionFrame query={query}>
        {d => d.available ? <Ingest d={d} /> : <Muted>No ingest has run yet, so there is no catalogue to read (data/db/catalog.db).</Muted>}
      </SectionFrame>
    </>
  );
}

// meta_ingest_run.status: running, ok, partial, short or failed.
const statusTone = (status: string | null) => (status === 'ok' ? 'gold' : status === 'failed' ? 'danger' : 'muted');

function Ingest({ d }: { d: AnalyticsData }) {
  const days = d.days.map(x => x.day);
  const runs = sum(d.days.map(x => x.runs));
  const failed = sum(d.days.map(x => x.failed));
  const [showIdle, setShowIdle] = useState(false);
  const sources = [...d.sources].sort((a, b) => b.records - a.records);
  // Most catalogue entries are one-off imports that never run in a given range; they'd bury the live ones.
  const idle = sources.filter(s => !s.runs && s.lastRunAt == null);
  const shown = showIdle ? sources : sources.filter(s => s.runs || s.lastRunAt != null);

  return (
    <>
      <Tiles>
        <StatTile label="Ingest runs" value={count(runs)} sub={`${count(failed)} failed`} trend={d.days.map(x => x.runs)} />
        <StatTile label="Records read" value={compact(sum(d.days.map(x => x.records)))} trend={d.days.map(x => x.records)} sub={`${d.days.length} days`} />
        <StatTile label="Rows added" value={compact(sum(d.days.map(x => x.inserted)))} trend={d.days.map(x => x.inserted)} sub="New rows written" />
        <StatTile label="Bytes fetched" value={bytes(sum(d.days.map(x => x.bytes)))} trend={d.days.map(x => x.bytes)} sub={`${count(d.sources.filter(s => s.record).length)} of ${count(d.sources.length)} sources recording`} />
      </Tiles>

      <Pair>
        <ChartCard title="Records per day" note="Read from upstream against rows actually added" table={{ columns: ['Day', 'Records', 'Added'], rows: [...d.days].reverse().map(x => [x.day, x.records, x.inserted]) }}>
          <TimeSeries
            label="Records read and rows added per day"
            days={days}
            series={[
              { key: 'records', label: 'Records read', color: ink(0), values: d.days.map(x => x.records) },
              { key: 'inserted', label: 'Rows added', color: ink(1), values: d.days.map(x => x.inserted) },
            ]}
          />
        </ChartCard>
        <ChartCard title="Runs per day" note="Finished and failed" table={{ columns: ['Day', 'Runs', 'Failed'], rows: [...d.days].reverse().map(x => [x.day, x.runs, x.failed]) }}>
          {runs ? (
            <StackedBars
              label="Ingest runs per day, finished and failed"
              format={count}
              columns={d.days.map(x => ({ key: x.day, label: shortDay(x.day) }))}
              series={[
                { key: 'ok', label: 'Finished', color: NEUTRAL, values: d.days.map(x => Math.max(0, x.runs - x.failed)) },
                { key: 'failed', label: 'Failed', color: REFUSED, values: d.days.map(x => x.failed) },
              ]}
            />
          ) : <Muted>No ingest runs in this range.</Muted>}
        </ChartCard>
      </Pair>

      <ChartCard title="Sources" note="Runs in the range and each source's latest run">
        {sources.length ? (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Source</th>
                  <th className={TH}>Switches</th>
                  <th className={`${TH} text-right`}>Runs</th>
                  <th className={`${TH} text-right`}>Failed</th>
                  <th className={`${TH} text-right`}>Records</th>
                  <th className={`${TH} text-right`}>Added</th>
                  <th className={`${TH} text-right`}>Fetched</th>
                  <th className={TH}>Last run</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(s => (
                  <tr key={s.code} className="align-top">
                    <td className={TD}>
                      <span className="text-ink-1">{s.name}</span>
                      <span className="block font-mono text-[11px] text-ink-3">{s.code}</span>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={s.record ? 'gold' : 'muted'}>{s.record ? 'recording' : 'not recording'}</Badge>
                        {s.build && <Badge tone="muted">builds</Badge>}
                      </div>
                    </td>
                    <td className={`${TD} text-right font-mono tabular-nums`}>{count(s.runs)}</td>
                    <td className={`${TD} text-right font-mono tabular-nums ${s.failed ? 'text-red' : 'text-ink-3'}`}>{count(s.failed)}</td>
                    <td className={`${TD} text-right font-mono tabular-nums`}>{compact(s.records)}</td>
                    <td className={`${TD} text-right font-mono tabular-nums`}>{compact(s.inserted)}</td>
                    <td className={`${TD} text-right font-mono tabular-nums`}>{bytes(s.bytes)}</td>
                    <td className={`${TD} max-w-72`}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {s.lastStatus && <Badge tone={statusTone(s.lastStatus)}>{s.lastStatus}</Badge>}
                        <span className="text-[12px] text-ink-3">{when(s.lastRunAt)}</span>
                      </div>
                      {s.lastError && <p className="mt-1 line-clamp-2 text-[11px] text-red" title={s.lastError}>{s.lastError}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {idle.length > 0 && (
              <button type="button" onClick={() => setShowIdle(v => !v)} className="mt-2 text-[12px] text-accent hover:underline">
                {showIdle ? 'Hide' : 'Show'} {count(idle.length)} source{idle.length === 1 ? '' : 's'} that never ran
              </button>
            )}
          </div>
        ) : <Muted>No sources are registered in the catalogue.</Muted>}
      </ChartCard>

      <Pair>
        <ChartCard title="Shards" note="Track, stream and layer databases the catalogue knows">
          {d.shards.length ? (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Kind</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Shards</th>
                    <th className={`${TH} text-right`}>Rows</th>
                    <th className={`${TH} text-right`}>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {d.shards.map(s => (
                    <tr key={`${s.kind}-${s.lod}-${s.status}`}>
                      <td className={`${TD} font-mono text-[12px]`}>{s.kind}{s.lod != null ? ` L${s.lod}` : ''}</td>
                      <td className={TD}><Badge tone={s.status === 'sealed' ? 'gold' : 'muted'}>{s.status}</Badge></td>
                      <td className={`${TD} text-right font-mono tabular-nums`}>{count(s.shards)}</td>
                      <td className={`${TD} text-right font-mono tabular-nums`}>{compact(s.rows)}</td>
                      <td className={`${TD} text-right font-mono tabular-nums`}>{bytes(s.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Muted>No shards yet.</Muted>}
        </ChartCard>
        <ChartCard title="History database" note="Rows in history.db's main tables">
          <BarList format={compact} share={false} limit={10} empty="history.db is empty or missing." rows={d.history.map(t => ({ key: t.table, label: <span className="font-mono text-[12px]">{t.table}</span>, value: t.rows }))} />
        </ChartCard>
      </Pair>
    </>
  );
}
