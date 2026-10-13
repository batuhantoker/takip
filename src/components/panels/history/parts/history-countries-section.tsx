'use client';

import { useId, useState } from 'react';
import { Select } from '@/components/ui/field';
import { PanelSection } from '@/components/ui/panel';
import { VIEW_GROUPS } from '@/lib/history/country-view';
import { formatAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import IndicatorSearch from './indicator-search';

const MORE = '__more';

/** The metric that fills the countries, from the curated list or any indicator, and where its values come from. The scale is the legend over the timeline. */
export function CountriesSection({ session }: { session: HistorySession }) {
  const [searching, setSearching] = useState(false);
  const sourceId = useId();
  const view = session.countries;
  const state = view.state();
  const code = state.status === 'off' ? '' : state.code;
  const curated = VIEW_GROUPS.some(g => g.views.some(v => v.code === code));

  let detail = null;
  if (state.status === 'loading') detail = <p className="text-small text-ink-3">Loading the values…</p>;
  else if (state.status === 'error') detail = <p className="text-small text-red">{state.message}</p>;
  else if (state.status === 'ready') {
    const { data, scale } = state;
    const step = data.step ?? 'year';
    const years = data.years && <span className="font-mono tabular-nums">{formatAt(data.years[0], step)}–{formatAt(data.years[1], step)}</span>;
    const many = data.sources.length > 1;
    detail = (
      <>
        {many ? (
          <div className="flex items-center gap-3">
            <label htmlFor={sourceId} className="shrink-0 text-small text-ink-3">Source</label>
            <Select id={sourceId} size="sm" value={data.source.code} onChange={e => view.select(data.metric.code, e.target.value)}
              options={data.sources.map(s => ({ value: s.code, label: s.name }))} className="flex-1" />
          </div>
        ) : (
          <p className="text-meta text-ink-3">{data.source.attribution ?? data.source.name}{years && <> · {years}</>}</p>
        )}
        <p className="mt-1.5 text-meta text-ink-3">
          {many && years && <>Values for {years}. </>}
          {scale.log ? 'Log scale. ' : ''}Drawn on today&apos;s borders; {step === 'day' ? 'days' : 'years'} between two values are estimated.
        </p>
      </>
    );
  }

  return (
    <PanelSection title="Colour countries by">
      <Select aria-label="Colour countries by" value={searching ? MORE : code}
        onChange={e => {
          if (e.target.value === MORE) setSearching(true);
          else {
            setSearching(false);
            view.select(e.target.value || null);
          }
        }}>
        <option value="">None</option>
        {VIEW_GROUPS.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.views.map(v => <option key={v.code} value={v.code}>{v.label}</option>)}
          </optgroup>
        ))}
        {code && !curated && <option value={code}>{state.status === 'ready' ? state.data.metric.name : code}</option>}
        <option value={MORE}>Search all indicators…</option>
      </Select>
      {searching && <div className="mt-3"><IndicatorSearch view={view} onDone={() => setSearching(false)} /></div>}
      {detail ? <div className="mt-3">{detail}</div> : (
        <p className="mt-2 text-meta text-ink-3">
          {session.layers().length ? 'Picking one hides the wartime borders.' : 'From the World Bank and Our World in Data, drawn on today’s borders.'}
        </p>
      )}
    </PanelSection>
  );
}
