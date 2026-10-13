'use client';

import type { ReactNode } from 'react';
import { VIEW_GROUPS } from '@/lib/history/country-view';
import { formatAt, rampFor, readingText, unitInline, yearAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { ChoiceMenu } from '@/components/map/replay/timeline-controls';
import { CountryRamp } from './country-ramp';
import { LegendCard } from './legend-card';

/** Over the History timeline while countries are coloured: the scale, the country under the pointer, the source. */
export default function CountryLegend({ session }: { session: HistorySession }) {
  const view = session.countries;
  const state = view.state();
  if (state.status === 'off') return null;
  const curated = VIEW_GROUPS.flatMap(g => g.views).find(v => v.code === state.code);
  const close = { closeLabel: 'Stop colouring countries', onClose: () => view.select(null) };

  if (state.status !== 'ready') {
    return (
      <LegendCard title={curated?.label ?? state.code} {...close}>
        {state.status === 'loading'
          ? <p className="text-small text-ink-3">Loading the values…</p>
          : <p className="text-small text-red">{state.message}</p>}
      </LegendCard>
    );
  }

  const { data, scale } = state;
  const step = data.step ?? 'year';
  const y = yearAt(session.clock.time());
  const now = step === 'day' ? y : Math.floor(y);
  const unit = data.metric.unit;
  const [first, last] = data.years ?? [now, now];
  const hovered = view.hovered();

  let line: ReactNode;
  if (hovered) {
    line = (
      <>
        <span className="font-medium text-ink-1">{hovered.name}</span>
        <span className="text-ink-2"> · {hovered.reading ? readingText(hovered.reading, unit, data.names, step) : `no data for ${formatAt(now, step)}`}</span>
      </>
    );
  } else if (now < first || now > last) {
    line = <span className="text-ink-3">No values {step === 'day' ? 'on' : 'in'} {formatAt(now, step)}. This runs {formatAt(first, step)}–{formatAt(last, step)}.</span>;
  } else {
    line = <span className="text-ink-3">Point at a country to read its value.</span>;
  }

  const years = <span className="tabular-nums">{formatAt(first, step)}–{formatAt(last, step)}</span>;
  const many = data.sources.length > 1;
  return (
    <LegendCard title={curated?.label ?? data.metric.name} subtitle={unit && !unitInline(unit) ? unit : undefined} {...close}
      source={many ? <>Values for {years}</> : <>{data.source.attribution ?? data.source.name} · {years}</>}
      footer={many && (
        <ChoiceMenu label="Source" value={data.source.code} className="max-w-full"
          groups={[{ label: 'Source', options: data.sources.map(s => ({ value: s.code, label: s.name })) }]}
          onChange={code => view.select(data.metric.code, code)} />
      )}>
      <CountryRamp ramp={rampFor(view.dark())} scale={scale} unit={unit} />
      <p className="mt-3 min-h-4 text-small">{line}</p>
      {hovered?.reading?.via && (
        <p className="mt-1 text-meta text-ink-3">Drawn on today&apos;s border; the source reports the whole {data.names[hovered.reading.via] ?? hovered.reading.via}.</p>
      )}
    </LegendCard>
  );
}
