'use client';

import { useAdminData } from '@/components/site/admin/admin-api';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { Button, ErrorText, Muted } from '@/components/site/admin/parts/admin-parts';
import type { PageDetail as Detail } from '../analytics-types';
import { count, duration, pct, plural } from '../lib/format';
import { deviceLabel, originLabel, pathLabel } from '../lib/journeys';
import { countryName, flag } from '../lib/place';
import { pathText } from './journey-flow';

/** 'origin:Google' → "Google, landing here"; a path → the page; '' → "Left". */
const stepLabel = (step: string) =>
  step.startsWith('origin:') ? <span className="text-ink-2">{originLabel(step.slice(7) || null)} <span className="text-ink-3">(landed here)</span></span>
    : step === '' ? <span className="text-ink-3">Left</span>
      : pathText(step);

/** One page across the range's visits: how they got to it, where they went next, how long they stayed. */
export function PageDetail({ range, path, onClose }: { range: string; path: string; onClose: () => void }) {
  const { data, error } = useAdminData<Detail>(`/analytics/pages/page${range}&path=${encodeURIComponent(path)}`);
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line-strong bg-surface-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-mono text-[13px] text-ink-1">{pathLabel(path)}</h2>
          {data && (
            <p className="mt-0.5 text-[12px] text-ink-3">
              {plural(data.visits, 'visit')} · {count(data.landings)} began here · {pct(data.exits, data.visits)} left from here
              {data.medianMs != null && <> · median {duration(data.medianMs)} before the next step</>}
            </p>
          )}
        </div>
        <Button onClick={onClose}>Close</Button>
      </div>
      <ErrorText message={error} />
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-[12px] font-medium text-ink-2">Came from</h3>
            <BarList format={count} limit={8} rows={data.cameFrom.map(c => ({ key: c.from, label: stepLabel(c.from), value: c.visits }))} empty="No visits in this range." />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-[12px] font-medium text-ink-2">Went to</h3>
            <BarList format={count} limit={8} rows={data.wentTo.map(w => ({ key: w.to, label: stepLabel(w.to), value: w.visits }))} empty="No visits in this range." />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-[12px] font-medium text-ink-2">Countries</h3>
            <BarList format={count} limit={6} rows={data.countries.map(c => ({ key: c.country ?? '', label: c.country ? `${flag(c.country)} ${countryName(c.country)}` : 'Not placed', value: c.visits }))} />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-[12px] font-medium text-ink-2">Devices</h3>
            <BarList format={count} rows={data.devices.map(d => ({ key: d.device, label: deviceLabel(d.device), value: d.visits }))} />
          </div>
        </div>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </section>
  );
}
