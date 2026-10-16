'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { curatedLabel, type Indicator, STARTERS, undated, withProjections, yearSpan } from '@/lib/history/countries/indicator-groups';
import { startsTogether } from '@/lib/history/projection';
import { formatAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { IndicatorPicks } from './indicator-picks';
import IndicatorSearch from './indicator-search';

/**
 * The metrics picked from every indicator in groups: one fills the countries, the rest are read beside it in the
 * legend. Below, where the colouring one's values come from. The scale is the legend over the timeline.
 */
export function CountriesSection({ session }: { session: HistorySession }) {
  const [browsing, setBrowsing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const sourceId = useId();
  const scenarioId = useId();
  const listId = useId();
  const view = session.countries;
  const state = view.state();
  const code = state.status === 'off' ? '' : state.code;
  const picks = view.picks();
  const empty = !picks.length;
  const [starters, setStarters] = useState<ReadonlyMap<string, Indicator>>(new Map());
  useEffect(() => {
    if (!empty) return;
    let live = true;
    view.catalogue().then(all => {
      if (live) setStarters(new Map(withProjections(all).filter(m => STARTERS.includes(m.code)).map(m => [m.code, m])));
    }, () => {});
    return () => { live = false; };
  }, [view, empty]);
  const done = () => {
    setBrowsing(false);
    trigger.current?.focus();
  };

  let detail = null;
  if (state.status === 'loading') detail = <p className="text-small text-ink-3">Loading the values…</p>;
  else if (state.status === 'error') detail = <p className="text-small text-red">{state.message}</p>;
  else if (state.status === 'ready') {
    const { data, scale } = state;
    const step = data.step ?? 'year';
    const { projection } = data;
    const years = data.years && <span className="font-mono tabular-nums">{formatAt(data.years[0], step)}–{formatAt(data.years[1], step)}</span>;
    const many = data.sources.length > 1;
    detail = (
      <>
        {many ? (
          <div className="flex items-center gap-3">
            <label htmlFor={sourceId} className="shrink-0 text-small text-ink-3">Source</label>
            <Select id={sourceId} size="sm" value={data.source.code} onChange={e => view.select(data.metric.code, e.target.value, projection?.scenario)}
              options={data.sources.map(s => ({ value: s.code, label: s.name }))} className="flex-1" />
          </div>
        ) : (
          <p className="text-meta text-ink-3">{data.source.attribution ?? data.source.name}{years && <> · {years}</>}</p>
        )}
        {projection && projection.scenarios.length > 1 && (
          <div className="mt-2 flex items-center gap-3">
            <label htmlFor={scenarioId} className="shrink-0 text-small text-ink-3">Scenario</label>
            <Select id={scenarioId} size="sm" value={projection.scenario} className="flex-1"
              onChange={e => view.select(data.metric.code, many ? data.source.code : undefined, e.target.value)}
              options={projection.scenarios.map(s => ({ value: s.id, label: s.label }))} />
          </div>
        )}
        <p className="mt-1.5 text-meta text-ink-3">
          {many && years && <>Values for {years}. </>}
          {scale.log ? 'Log scale. ' : ''}Drawn on today&apos;s borders; {step === 'day' ? 'days' : 'years'} between two values are estimated.
          {projection && (
            <>
              {projection.simulated ? (
                <> Every value is model output, hatched on the map: the {projection.simulated.label} to <span className="font-mono tabular-nums">{formatAt(projection.simulated.to)}</span>, then
                  the {projection.label} to <span className="font-mono tabular-nums">{formatAt(projection.to)}</span>.</>
              ) : (
                <>{' '}{startsTogether(projection) ? <>From <span className="font-mono tabular-nums">{formatAt(projection.from)}</span></> : <>After each country&apos;s last estimate</>} the values
                  are a {projection.label}, hatched on the map; the timeline runs on to <span className="font-mono tabular-nums">{formatAt(projection.to)}</span>.</>
              )}
              {projection.range && <> Readings give the {projection.range.label}.</>}
            </>
          )}
        </p>
      </>
    );
  }

  return (
    <PanelSection title="Colour countries by"
      action={picks.length > 1 ? <Button variant="ghost" size="sm" onClick={() => view.select(null)}>Clear all</Button> : undefined}>
      {picks.length > 0 && <div className="mb-2"><IndicatorPicks view={view} picks={picks} coloured={code} /></div>}
      <Button ref={trigger} size="sm" icon={browsing ? undefined : Plus} aria-expanded={browsing} aria-controls={browsing ? listId : undefined}
        onClick={() => setBrowsing(b => !b)}>
        {browsing ? 'Done' : picks.length ? 'Add another' : 'Pick an indicator'}
      </Button>
      {!picks.length && !browsing && (
        <div className="mt-3">
          <p className="mb-0.5 text-meta text-ink-3">Or start with</p>
          {STARTERS.map(c => {
            const m = starters.get(c);
            const label = curatedLabel(c, true) ?? c;
            return (
              <ListRow key={c} compact title={m?.years ? undated(label) : label} onClick={() => view.select(c)}
                subtitle={m?.years && <span className="font-mono text-meta text-ink-3 tabular-nums">{yearSpan(m.years, m.projectedTo)}</span>} />
            );
          })}
        </div>
      )}
      {browsing && <div className="mt-3"><IndicatorSearch id={listId} view={view} picked={picks.map(p => p.code)} onDone={done} /></div>}
      {picks.length > 1 && <p className="mt-3 text-meta text-ink-3">Point at a country to read every pick in the legend; click one to put it on the map.</p>}
      {detail ? <div className="mt-3">{detail}</div> : (
        <p className="mt-2 text-meta text-ink-3">
          {session.layers().length ? 'Picking one hides the borders.' : 'From the World Bank, Our World in Data and the UN, drawn on today’s borders.'}
        </p>
      )}
    </PanelSection>
  );
}
