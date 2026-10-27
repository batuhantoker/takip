import Link from 'next/link';
import { tabHref } from '@/components/site/admin/lib/areas';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { Muted, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsSystem } from './analytics-types';
import { bytes, count, duration, ms, pct, shortDay, sum } from './lib/format';
import { NEUTRAL } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { More } from './parts/more';
import { Pair, SectionFrame, Tiles } from './parts/section-frame';

const NUM = `${TD} text-right font-mono tabular-nums`;

export function SystemSection({ query }: { query: AnalyticsQuery<AnalyticsSystem> }) {
  return <SectionFrame query={query}>{s => <System s={s} />}</SectionFrame>;
}

function System({ s }: { s: AnalyticsSystem }) {
  const usedMemory = s.host.totalMemory - s.host.freeMemory;
  const lag = s.eventLoopLagMs;
  const failedJobs = sum(s.jobs.map(j => j.failed));
  const http = [...s.http].sort((a, b) => b.requests - a.requests);

  return (
    <>
      <p className="text-[12px] text-ink-3">The accounts api&apos;s process and its host. Traffic numbers count from when the api last started.</p>
      <Tiles>
        <StatTile label="Up for" value={duration(s.now - s.startedAt)} sub={`Since ${when(s.startedAt)}`} />
        <StatTile label="Memory (RSS)" value={bytes(s.memory.rss)} sub={`Heap ${bytes(s.memory.heapUsed)} of ${bytes(s.memory.heapTotal)}`} />
        <StatTile label="Load (1 min)" value={s.host.load[0]?.toFixed(2) ?? '—'} sub={`${s.host.cpus} CPUs · 5 min ${s.host.load[1]?.toFixed(2) ?? '—'} · 15 min ${s.host.load[2]?.toFixed(2) ?? '—'}`} />
        <StatTile label="Host memory" value={pct(usedMemory, s.host.totalMemory)} sub={`${bytes(usedMemory)} of ${bytes(s.host.totalMemory)} in use`} />
        <StatTile label="Event-loop lag" value={ms(lag)} sub={lag == null ? 'Not measured' : lag > 100 ? 'High: requests are waiting' : 'Healthy'} />
        <StatTile label="Runtime" value={s.node} sub={s.platform} />
        <StatTile label="Failed jobs" value={count(failedJobs)} sub={`${count(sum(s.jobs.map(j => j.pending)))} waiting`} />
        <StatTile label="Workspaces" value={count(s.workspaces.total)} sub={`${count(s.workspaces.createdInRange)} created in the range`} />
      </Tiles>

      <ChartCard title="HTTP by route group" note="Every request the api answered since it started; errors are 5xx">
        {http.length ? (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Group</th>
                  <th className={`${TH} text-right`}>Requests</th>
                  <th className={`${TH} text-right`}>Errors</th>
                  <th className={`${TH} text-right`}>Error rate</th>
                  <th className={`${TH} text-right`}>p50</th>
                  <th className={`${TH} text-right`}>p95</th>
                </tr>
              </thead>
              <tbody>
                {http.map(h => (
                  <tr key={h.group}>
                    <td className={`${TD} font-mono text-[12px]`}>{h.group}</td>
                    <td className={NUM}>{count(h.requests)}</td>
                    <td className={`${NUM} ${h.errors ? 'text-red' : 'text-ink-3'}`}>{count(h.errors)}</td>
                    <td className={`${NUM} ${h.errors ? 'text-red' : 'text-ink-3'}`}>{pct(h.errors, h.requests, 1)}</td>
                    <td className={NUM}>{ms(h.p50Ms)}</td>
                    <td className={`${NUM} ${(h.p95Ms ?? 0) > 1000 ? 'text-amber' : ''}`}>{ms(h.p95Ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Muted>No requests since the api started.</Muted>}
      </ChartCard>

      <ChartCard title="Job queue" note="Background jobs by kind: billing, mail, pruning, backups">
        {s.jobs.length ? (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Kind</th>
                  <th className={`${TH} text-right`}>Waiting</th>
                  <th className={`${TH} text-right`}>Failed</th>
                  <th className={`${TH} text-right`}>Done</th>
                  <th className={TH}>Last done</th>
                  <th className={TH}>Last error</th>
                </tr>
              </thead>
              <tbody>
                {s.jobs.map(j => (
                  <tr key={j.kind} className={j.failed ? 'bg-red/5' : ''}>
                    <td className={`${TD} font-mono text-[12px]`}>{j.kind}</td>
                    <td className={NUM}>{count(j.pending)}</td>
                    <td className={`${NUM} ${j.failed ? 'text-red' : 'text-ink-3'}`}>{count(j.failed)}</td>
                    <td className={NUM}>{count(j.done)}</td>
                    <td className={`${TD} whitespace-nowrap text-ink-3`}>{when(j.lastDoneAt)}</td>
                    <td className={`${TD} max-w-80`}>{j.lastError ? <p className="line-clamp-2 text-[11px] text-red" title={j.lastError}>{j.lastError}</p> : <span className="text-ink-3">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Muted>The queue is empty.</Muted>}
      </ChartCard>

      <Pair>
        <ChartCard title="Backups" note="Copies of app.db the api writes each day">
          {s.backups ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
              <div><dt className="text-[11px] text-ink-3">Kept</dt><dd className="font-mono text-[18px] text-ink-1">{count(s.backups.count)}</dd></div>
              <div><dt className="text-[11px] text-ink-3">Total size</dt><dd className="font-mono text-[18px] text-ink-1">{bytes(s.backups.bytes)}</dd></div>
              <div className="col-span-2">
                <dt className="text-[11px] text-ink-3">Latest</dt>
                <dd className="text-ink-1">
                  {s.backups.latest ? <><span className="font-mono text-[12px]">{s.backups.latest.name}</span> · {bytes(s.backups.latest.bytes)} · {when(s.backups.latest.at)}</> : <span className="text-amber">None written yet</span>}
                </dd>
              </div>
            </dl>
          ) : <Muted>Backups aren&apos;t configured (APP_BACKUP_DIR).</Muted>}
        </ChartCard>
        <ChartCard title="Issue reports" note={`${count(s.reports.open)} open · ${count(s.reports.resolved)} resolved`} actions={<Link href={tabHref('accounts', 'reports')} className="text-[12px] text-accent hover:underline">Open reports</Link>}>
          {sum(s.reports.days.map(d => d.created)) ? (
            <StackedBars label="Issue reports filed per day" format={count} height={100}
              columns={s.reports.days.map(d => ({ key: d.day, label: shortDay(d.day) }))}
              series={[{ key: 'created', label: 'Filed', color: NEUTRAL, values: s.reports.days.map(d => d.created) }]} />
          ) : <Muted>No reports filed in this range.</Muted>}
        </ChartCard>
      </Pair>

      <More id="system-audit" title="Admin and account changes" holds="Audit events per day and the most common ones">
        <Pair>
          <ChartCard title="Admin and account changes per day" note="Audit events (kept 30 days)" actions={<Link href={tabHref('accounts', 'audit')} className="text-[12px] text-accent hover:underline">Audit log</Link>}>
            {sum(s.audit.days.map(d => d.events)) ? (
              <StackedBars label="Audit events per day" format={count} height={100}
                columns={s.audit.days.map(d => ({ key: d.day, label: shortDay(d.day) }))}
                series={[{ key: 'events', label: 'Events', color: NEUTRAL, values: s.audit.days.map(d => d.events) }]} />
            ) : <Muted>No audit events in this range.</Muted>}
          </ChartCard>
          <ChartCard title="Most common changes">
            <BarList format={count} rows={s.audit.actions.map(a => ({ key: a.action, label: <span className="font-mono text-[12px]">{a.action}</span>, value: a.events }))} empty="No audit events in this range." />
          </ChartCard>
        </Pair>
      </More>
    </>
  );
}
