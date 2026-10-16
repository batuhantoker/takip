'use client';

import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import type { ChartedCountry } from '@/lib/history/countries/chart';
import type { CountryPick } from '@/lib/history/countries/view';
import { nameOf } from '@/lib/history/countries/indicator-groups';
import type { Range } from '@/components/map/country-chart/lib/chart-geometry';
import { LineChart } from './line-chart';
import { PlotValues } from './plot-values';

/**
 * One picked indicator, charted for the countries: its values at `t` and its lines. Beside other indicators it
 * folds under its name, and the ones not colouring the map offer to.
 */
export function IndicatorPlot({ pick, onMap, heading, open = true, onOpenChange, countries, at, hover, range, height, onHover, onSeek, onRange, onColour }: {
  pick: CountryPick;
  onMap: boolean;
  /** Alone it needs none: the window's title names it. */
  heading: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  countries: ChartedCountry[];
  /** The clock, as a fractional year. */
  at: number;
  hover: number | null;
  range: Range | null;
  height?: number;
  onHover: (t: number | null) => void;
  onSeek: (t: number) => void;
  onRange: (r: Range | null) => void;
  onColour: () => void;
}) {
  const name = nameOf(pick, true);
  let body;
  if (pick.status === 'loading') body = <p className="py-3 text-small text-ink-3">Loading the values…</p>;
  else if (pick.status === 'error') body = <p className="py-3 text-small text-red">{pick.message}</p>;
  else if (!countries.some(c => pick.data.values[c.key]?.length)) {
    body = <p className="py-3 text-small text-ink-3">None of these countries has values for this indicator.</p>;
  } else {
    body = (
      <>
        <PlotValues data={pick.data} countries={countries} t={hover ?? at} />
        <div className="mt-2">
          <LineChart data={pick.data} log={pick.scale.log} countries={countries} at={at} hover={hover} range={range} height={height}
            onHover={onHover} onSeek={onSeek} onRange={onRange} />
        </div>
      </>
    );
  }
  if (!heading) return <section aria-label={name}>{body}</section>;
  return (
    <Disclosure title={name} hint={pick.status === 'ready' ? pick.data.metric.unit : undefined} open={open} onOpenChange={o => onOpenChange?.(o)}
      action={onMap ? <span className="text-meta text-ink-3">On the map</span> : (
        <Button variant="ghost" size="sm" aria-label={`Colour the map by ${name}`} onClick={onColour}>Show on map</Button>
      )}>
      {body}
    </Disclosure>
  );
}
