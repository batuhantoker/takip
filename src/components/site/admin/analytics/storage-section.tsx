import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Meter } from '@/components/site/admin/charts/meter';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { Button, Muted, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsStorage } from './analytics-types';
import { bytes, count, duration, shortDay } from './lib/format';
import { ink, OTHER, topKeys } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { Pair, SectionFrame, SectionHeading } from './parts/section-frame';
import { StorageGroups } from './parts/storage-groups';

const hour = (iso: string | null) => (iso ? iso.replace('T', ' ').slice(0, 16) : '—');

export function StorageSection({ query, onRescan }: { query: AnalyticsQuery<AnalyticsStorage>; onRescan: () => void }) {
  return (
    <>
      <SectionHeading>Storage</SectionHeading>
      <SectionFrame query={query}>{s => <Storage s={s} onRescan={onRescan} rescanning={query.stale} />}</SectionFrame>
    </>
  );
}

function Storage({ s, onRescan, rescanning }: { s: AnalyticsStorage; onRescan: () => void; rescanning: boolean }) {
  const sources = [...s.archive.sources].sort((a, b) => b.bytes - a.bytes);
  const { keep, folded } = topKeys(Object.fromEntries(sources.map(src => [src.source, src.bytes])));
  const series = [
    ...keep.map((src, i) => ({ key: src, label: src, color: ink(i), values: s.archive.days.map(d => d.bytes[src] ?? 0) })),
    ...(folded ? [{ key: 'other', label: 'Other', color: OTHER, values: s.archive.days.map(d => Object.entries(d.bytes).reduce((t, [k, v]) => (keep.includes(k) ? t : t + v), 0)) }] : []),
  ];
  const written = s.archive.days.some(d => Object.values(d.bytes).some(v => v > 0));

  return (
    <>
      <ChartCard
        title="Disk"
        note={`Scanned ${when(s.scannedAt)} in ${duration(s.tookMs)}`}
        actions={<Button onClick={onRescan} disabled={rescanning} className="h-7">{rescanning ? 'Scanning…' : 'Rescan'}</Button>}
      >
        <div className="text-[13px] text-ink-2">
          TAKIP keeps <span className="font-mono text-ink-1">{bytes(s.total)}</span> on disk{s.disk ? <> of a <span className="font-mono text-ink-1">{bytes(s.disk.total)}</span> volume</> : null}.
        </div>
        {s.disk ? (
          <Meter
            format={bytes}
            total={s.disk.total}
            rest="Free"
            parts={[
              { label: 'TAKIP data', value: s.total, color: 'var(--accent)' },
              { label: 'Everything else', value: Math.max(0, s.disk.used - s.total), color: 'var(--ink-3)' },
            ]}
          />
        ) : <Muted>The volume&apos;s size couldn&apos;t be read.</Muted>}
      </ChartCard>

      <ChartCard title="Where it is" note="Open a store to see its biggest files and folders">
        {s.groups.length ? <StorageGroups groups={s.groups} total={s.total} /> : <Muted>Nothing found under the data directory.</Muted>}
      </ChartCard>

      <ChartCard
        title="Raw archive written per day"
        note="From the recorder's hourly files, by source"
        table={written ? { columns: ['Day', ...series.map(x => x.label)], rows: s.archive.days.map((d, i) => [d.day, ...series.map(x => x.values[i])]).reverse() } : null}
      >
        {written ? (
          <StackedBars label="Raw archive bytes written per day, by source" format={bytes} columns={s.archive.days.map(d => ({ key: d.day, label: shortDay(d.day) }))} series={series} />
        ) : <Muted>The recorder hasn&apos;t written anything in the last 30 days.</Muted>}
      </ChartCard>

      <Pair>
        <ChartCard title="Archive sources">
          {sources.length ? (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Source</th>
                    <th className={`${TH} text-right`}>Size</th>
                    <th className={`${TH} text-right`}>Hours</th>
                    <th className={TH}>From – to (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(src => (
                    <tr key={src.source}>
                      <td className={`${TD} font-mono text-[12px]`}>{src.source}</td>
                      <td className={`${TD} text-right font-mono tabular-nums`}>{bytes(src.bytes)}</td>
                      <td className={`${TD} text-right font-mono tabular-nums`}>{count(src.files)}</td>
                      <td className={`${TD} whitespace-nowrap font-mono text-[11px] text-ink-3`}>{hour(src.firstHour)} – {hour(src.lastHour)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Muted>No raw archive yet.</Muted>}
        </ChartCard>
        <ChartCard title="Accounts database" note="Rows per table in app.db">
          <BarList format={count} share={false} limit={10} rows={s.appTables.map(t => ({ key: t.table, label: <span className="font-mono text-[12px]">{t.table}</span>, value: t.rows }))} />
        </ChartCard>
      </Pair>
    </>
  );
}
