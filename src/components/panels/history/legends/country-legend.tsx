'use client';

import type { ReactNode } from 'react';
import { curatedLabel } from '@/lib/history/countries/indicator-groups';
import { labelAt, projectedAt, startsTogether, startText } from '@/lib/history/projection';
import { formatAt, rampFor, readingText, unitInline, yearAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { ChoiceMenu } from '@/components/map/replay/timeline-controls';
import { useT } from '@/components/ui/use-t';
import { CountryRamp } from './country-ramp';
import { LegendCard } from './legend-card';
import { PickReadings } from './pick-readings';

/** Over the History timeline while countries are coloured: the scale, the country under the pointer, the other picks, the source. */
export default function CountryLegend({ session }: { session: HistorySession }) {
  const t = useT();
  const view = session.countries;
  const state = view.state();
  if (state.status === 'off') return null;
  const curated = curatedLabel(state.code, true, t);
  const close = { closeLabel: t('Stop colouring countries'), onClose: () => view.select(null) };

  if (state.status !== 'ready') {
    return (
      <LegendCard title={curated ?? state.code} {...close}>
        {state.status === 'loading'
          ? <p className="text-small text-ink-3">{t('Loading the values…')}</p>
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
  const point = others.length
    ? t('Point at a country to read every pick; click it to chart it over time.')
    : t('Point at a country to read its value; click it to chart it over time.');
  const at = (x: number) => formatAt(x, step, t);

  let line: ReactNode;
  if (hovered) {
    line = (
      <>
        <span className="font-medium text-ink-1">{hovered.name}</span>
        <span className="text-ink-2"> · {hovered.reading ? readingText(hovered.reading, unit, data.names, step, projection?.label, t) : t('no data for {date}', { date: at(now) })}</span>
      </>
    );
  } else if (now < first || now > last) {
    const vars = { date: at(now), first: at(first), last: at(last) };
    line = <span className="text-ink-3">{step === 'day' ? t('No values on {date}. This runs {first}–{last}.', vars) : t('No values in {date}. This runs {first}–{last}.', vars)}</span>;
  } else if (projectedAt(projection, time)) {
    const vars = { date: at(now), projection: labelAt(projection!, now) };
    const whose = startsTogether(projection!)
      ? t('{date} values are a {projection}, not measurements.', vars)
      : t('Hatched countries’ {date} values are a {projection}, not measurements.', vars);
    line = <span className="text-ink-3"><span className="text-ink-2">{whose}</span> {point}</span>;
  } else {
    line = <span className="text-ink-3">{point}</span>;
  }

  const years = <span className="tabular-nums">{at(first)}–{at(last)}{projection && <>, {projection.simulated ? t('all modelled') : startText(projection, t)}</>}</span>;
  const many = data.sources.length > 1;
  const scenarios = projection && projection.scenarios.length > 1 ? projection.scenarios : null;
  return (
    <LegendCard title={curated ?? data.metric.name} subtitle={unit && !unitInline(unit) ? unit : undefined} {...close}
      source={many ? t.rich('Values for {years}', { years }) : <>{data.source.attribution ?? data.source.name} · {years}</>}
      footer={(many || scenarios) && (
        <>
          {many && (
            <ChoiceMenu label={t('Source')} value={data.source.code} className="max-w-full"
              groups={[{ label: t('Source'), options: data.sources.map(s => ({ value: s.code, label: s.name })) }]}
              onChange={code => view.select(data.metric.code, code, projection?.scenario)} />
          )}
          {scenarios && (
            <ChoiceMenu label={t('Scenario')} value={projection!.scenario} className="max-w-full"
              groups={[{ label: projection!.short, options: scenarios.map(s => ({ value: s.id, label: s.label })) }]}
              onChange={id => view.select(data.metric.code, many ? data.source.code : undefined, id)} />
          )}
        </>
      )}>
      <CountryRamp ramp={rampFor(view.dark())} scale={scale} unit={unit} projected={projection ? (projection.simulated ? t('Modelled') : t('Projected')) : undefined} />
      <p className="mt-3 min-h-4 text-small">{line}</p>
      {hovered?.reading?.via && (
        <p className="mt-1 text-meta text-ink-3">{t("Drawn on today's border; the source reports the whole {name}.", { name: data.names[hovered.reading.via] ?? hovered.reading.via })}</p>
      )}
      {others.length > 0 && <PickReadings view={view} picks={others} hoveredKey={hovered?.key ?? null} y={y} />}
    </LegendCard>
  );
}
