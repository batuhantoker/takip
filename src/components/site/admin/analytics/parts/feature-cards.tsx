import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Meter } from '@/components/site/admin/charts/meter';
import { Sparkline } from '@/components/site/admin/charts/stat-tile';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsEngagement, FeatureUse } from '../analytics-types';
import { featureLabel, splitFeature } from '../lib/features';
import { count, minutes, sum } from '../lib/format';
import { ink } from '../lib/series';
import { Pair } from './section-frame';

export const reach = (f: FeatureUse) => `${count(f.users)} accounts · ${count(f.visitors)} visitor-days`;

const rowsOf = (features: FeatureUse[]) => features.map(f => ({ key: f.feature, label: featureLabel(f.feature), value: f.minutes, detail: reach(f) }));

/** Panels (with a small multiple per panel over the range), layers, windows and devices. */
export function FeatureCards({ e, panels, layers, devices }: { e: AnalyticsEngagement; panels: FeatureUse[]; layers: FeatureUse[]; devices: FeatureUse[] }) {
  const windows = e.features.filter(f => splitFeature(f.feature).kind === 'window').sort((a, b) => b.minutes - a.minutes);
  const daily = [...new Set(e.featureDays.flatMap(d => Object.keys(d.minutes)))]
    .filter(f => f.startsWith('panel:'))
    .map(f => ({ feature: f, values: e.featureDays.map(d => d.minutes[f] ?? 0) }))
    .map(p => ({ ...p, total: sum(p.values) }))
    .filter(p => p.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <Pair>
        <ChartCard title="Panels" note="Time with each sidebar panel open, and who opened it">
          <BarList format={minutes} share={false} limit={10} rows={rowsOf(panels)} empty="No panel time in this range yet." />
        </ChartCard>
        <ChartCard title="Panels per day" note="Each panel on its own scale; the dot is the last day">
          {daily.length ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
              {daily.map(p => (
                <li key={p.feature} className="flex min-w-0 items-center justify-between gap-2 border-b border-line pb-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] text-ink-1">{featureLabel(p.feature)}</div>
                    <div className="font-mono text-[11px] tabular-nums text-ink-3">{minutes(p.total)}</div>
                  </div>
                  {p.values.length > 1 && <Sparkline values={p.values} width={96} height={28} />}
                </li>
              ))}
            </ul>
          ) : <Muted>No panel time in this range yet.</Muted>}
        </ChartCard>
      </Pair>

      <Pair>
        <ChartCard title="Layers" note="Minutes each data layer was on the map">
          <BarList format={minutes} share={false} limit={12} rows={rowsOf(layers)} empty="No layer time in this range yet." />
        </ChartCard>
        <div className="flex flex-col gap-4">
          <ChartCard title="Windows" note="Camera players, live feeds, dossiers and search open over the map">
            <BarList format={minutes} share={false} rows={rowsOf(windows)} empty="No windows opened in this range." />
          </ChartCard>
          <ChartCard title="Devices" note="Map minutes on desktop and on phones">
            {devices.length ? (
              <Meter
                format={minutes}
                total={sum(devices.map(d => d.minutes))}
                parts={['device:desktop', 'device:mobile'].map((f, i) => ({ label: featureLabel(f), value: devices.find(d => d.feature === f)?.minutes ?? 0, color: ink(i) }))}
              />
            ) : <Muted>No map time in this range yet.</Muted>}
          </ChartCard>
        </div>
      </Pair>
    </>
  );
}
