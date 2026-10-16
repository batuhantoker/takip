'use client';

import type { ReactNode } from 'react';
import { VIEW_GROUPS } from '@/lib/history/countries/view';
import { labelAt, projectedAt, startsTogether, startText } from '@/lib/history/projection';
import { formatAt, rampFor, readingText, unitInline, yearAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { ChoiceMenu } from '@/components/map/replay/timeline-controls';
import { CountryRamp } from './country-ramp';
import { LegendCard } from './legend-card';
import { PickReadings } from './pick-readings';

/** Over the History timeline while countries are coloured: the scale, the country under the pointer, the other picks, the source. */
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
  const { projection } = data;
  const step = data.step ?? 'year';
  const time = session.clock.time();
  const y = yearAt(time);
  const now = step === 'day' ? y : Math.floor(y);
  const unit = data.metric.unit;
  const [first, last] = data.years ?? [now, now];
  const hovered = view.hovered();
  const others = view.picks().filter(p => p.code !== state.code);
  const point = `Point at a country to read ${others.length ? 'every pick' : 'its value'}; click it to chart it over time.`;

  let line: ReactNode;
  if (hovered) {
    line = (
      <>
        <span className="font-medium text-ink-1">{hovered.name}</span>
        <span className="text-ink-2"> · {hovered.reading ? readingText(hovered.reading, unit, data.names, step, projection?.label) : `no data for ${formatAt(now, step)}`}</span>
      </>
    );
  } else if (now < first || now > last) {
    line = <span className="text-ink-3">No values {step === 'day' ? 'on' : 'in'} {formatAt(now, step)}. This runs {formatAt(first, step)}–{formatAt(last, step)}.</span>;
  } else if (projectedAt(projection, time)) {
    const whose = startsTogether(projection!) ? `${formatAt(now, step)} values are` : `Hatched countries’ ${formatAt(now, step)} values are`;
    line = <span className="text-ink-3"><span className="text-ink-2">{whose} a {labelAt(projection!, now)}, not measurements.</span> {point}</span>;
  } else {
    line = <span className="text-ink-3">{point}</span>;
  }

  const years = <span className="tabular-nums">{formatAt(first, step)}–{formatAt(last, step)}{projection && <>, {projection.simulated ? 'all modelled' : startText(projection)}</>}</span>;
  const many = data.sources.length > 1;
  const scenarios = projection && projection.scenarios.length > 1 ? projection.scenarios : null;
  return (
    <LegendCard title={curated?.label ?? data.metric.name} subtitle={unit && !unitInline(unit) ? unit : undefined} {...close}
      source={many ? <>Values for {years}</> : <>{data.source.attribution ?? data.source.name} · {years}</>}
      footer={(many || scenarios) && (
        <>
          {many && (
            <ChoiceMenu label="Source" value={data.source.code} className="max-w-full"
              groups={[{ label: 'Source', options: data.sources.map(s => ({ value: s.code, label: s.name })) }]}
              onChange={code => view.select(data.metric.code, code, projection?.scenario)} />
          )}
          {scenarios && (
            <ChoiceMenu label="Scenario" value={projection!.scenario} className="max-w-full"
              groups={[{ label: projection!.short, options: scenarios.map(s => ({ value: s.id, label: s.label })) }]}
              onChange={id => view.select(data.metric.code, many ? data.source.code : undefined, id)} />
          )}
        </>
      )}>
      <CountryRamp ramp={rampFor(view.dark())} scale={scale} unit={unit} projected={projection ? (projection.simulated ? 'Modelled' : 'Projected') : undefined} />
      <p className="mt-3 min-h-4 text-small">{line}</p>
      {hovered?.reading?.via && (
        <p className="mt-1 text-meta text-ink-3">Drawn on today&apos;s border; the source reports the whole {data.names[hovered.reading.via] ?? hovered.reading.via}.</p>
      )}
      {others.length > 0 && <PickReadings view={view} picks={others} hoveredKey={hovered?.key ?? null} y={y} />}
    </LegendCard>
  );
}
