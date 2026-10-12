'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { VIEW_GROUPS } from '@/lib/history/country-view';
import { formatValue, formatYear, rampFor, readingText, unitInline, yearAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';

const HATCH = 'repeating-linear-gradient(135deg, rgba(138,135,127,0.55) 0 1px, transparent 1px 5px)';

/** Above the History bar while countries are coloured: the scale, the country under the pointer, the source. */
export default function CountryLegend({ session }: { session: HistorySession }) {
  const view = session.countries;
  const state = view.state();
  const hovered = view.hovered();
  const year = Math.floor(yearAt(session.clock.time()));

  let body: ReactNode = null;
  if (state.status === 'loading') body = <p className="text-[11px] text-[var(--text-muted)]">Loading…</p>;
  else if (state.status === 'error') body = <p className="text-[11px] text-[var(--alert-red)]">{state.message}</p>;
  else if (state.status === 'ready') {
    const { data, scale } = state;
    const unit = data.metric.unit;
    const longUnit = unit && !unitInline(unit) ? unit : null;
    const ramp = rampFor(view.dark());
    const [first, last] = data.years ?? [year, year];
    const outside = year < first || year > last;
    body = (
      <>
        {longUnit && <p className="text-[10.5px] text-[var(--text-muted)] -mt-0.5 mb-1.5">{longUnit}</p>}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="h-2.5 rounded-sm" style={{ background: `linear-gradient(to right, ${ramp.join(',')})` }} />
            <div className="mt-1 flex justify-between font-mono text-[9.5px] tabular-nums text-[var(--text-secondary)]">
              <span>{formatValue(scale.lo, unit)}</span>
              <span>{formatValue(scale.at(0.5), unit)}</span>
              <span>{formatValue(scale.hi, unit)}+</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-5 h-2.5 rounded-sm border border-white/10" style={{ background: HATCH }} />
            <span className="text-[9.5px] text-[var(--text-muted)]">no data</span>
          </div>
        </div>
        <p className="mt-2 min-h-[16px] text-[11px] text-[var(--text-primary)]">
          {hovered ? (
            <>
              <span className="font-medium">{hovered.name}</span>
              <span className="text-[var(--text-secondary)]">{' · '}{hovered.reading ? readingText(hovered.reading, unit, data.names) : `no data for ${formatYear(year)}`}</span>
            </>
          ) : outside ? (
            <span className="text-[var(--text-muted)]">No values in {formatYear(year)}: this metric runs {formatYear(first)}–{formatYear(last)}.</span>
          ) : (
            <span className="text-[var(--text-muted)]">Point at a country for its value.</span>
          )}
        </p>
        {hovered?.reading?.via && (
          <p className="text-[10px] text-[var(--text-muted)]">Drawn on today&apos;s border; the source reports the whole {data.names[hovered.reading.via] ?? hovered.reading.via}.</p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
          <span className="truncate" title={data.source.attribution ?? data.source.name}>{data.source.attribution ?? data.source.name} · {formatYear(first)}–{formatYear(last)}</span>
          {data.sources.length > 1 && (
            <select aria-label="Source" value={data.source.code} onChange={e => view.select(data.metric.code, e.target.value)}
              className="ml-auto h-5 px-1 rounded bg-black/40 border border-white/10 text-[10px] text-[var(--text-secondary)] focus:outline-none">
              {data.sources.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          )}
        </div>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">{scale.log ? 'Log scale. ' : ''}Years between two values are estimated.</p>
      </>
    );
  }

  const curated = VIEW_GROUPS.flatMap(g => g.views).find(v => state.status !== 'off' && v.code === state.code);
  const title = state.status === 'ready' ? state.data.metric.name : state.status !== 'off' ? curated?.label ?? state.code : '';

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[360px] max-w-[calc(100vw-32px)] px-3 py-2.5 rounded-lg bg-[var(--bg-panel)] border border-white/[0.08] backdrop-blur-xl shadow-lg font-sans text-[var(--text-secondary)]">
      <div className="flex items-start gap-2 mb-1.5">
        <h3 className="flex-1 text-[12px] font-medium text-[var(--text-primary)] leading-snug">{title}</h3>
        <button type="button" aria-label="Stop colouring countries" onClick={() => view.select(null)}
          className="w-5 h-5 -mr-1 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)]">
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      {body}
    </div>
  );
}
