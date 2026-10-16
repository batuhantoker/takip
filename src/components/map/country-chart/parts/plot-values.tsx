'use client';

import type { ChartedCountry } from '@/lib/history/countries/chart';
import { countryReading, formatValue, readingText, type SeriesPayload } from '@/lib/history/series';
import { LineKey } from './country-keys';

/** One chart's readout: each country's value at `t`, keyed by its line, in the legend's order. */
export function PlotValues({ data, countries, t }: { data: SeriesPayload; countries: ChartedCountry[]; t: number }) {
  const unit = data.metric.unit;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-small">
      {countries.map(c => {
        const r = countryReading(data, c.key, t);
        return (
          <li key={c.key} className="flex items-center gap-1.5" title={`${c.name}: ${r ? readingText(r, unit, data.names, data.step, data.projection?.label) : 'no data'}`}>
            <LineKey slot={c.slot} />
            <span className="sr-only">{c.name}</span>
            {r
              ? <span className="font-mono text-ink-1 tabular-nums">{r.kind === 'interpolated' && '≈ '}{formatValue(r.shown, unit)}</span>
              : <span className="text-ink-3">no data</span>}
          </li>
        );
      })}
    </ul>
  );
}
