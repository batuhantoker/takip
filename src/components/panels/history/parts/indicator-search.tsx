'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Check, SearchX } from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { Disclosure } from '@/components/ui/disclosure';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/field';
import { ListRow } from '@/components/ui/list-row';
import { type CountryView, MAX_PICKS } from '@/lib/history/countries/view';
import { filterIndicators, groupIndicators, type Indicator, placeOf, SUGGESTED, suggestedGroup, undated, withProjections, yearSpan } from '@/lib/history/countries/indicator-groups';

/**
 * Every mappable country metric (WDI, OWID…) in folding groups, the curated picks first, and a search
 * over all of them. A row adds its metric, colouring the map by it, or drops it again; the list stays open
 * for more. Escape on an empty field closes it.
 */
export default function IndicatorSearch({ id, view, picked, onDone }: { id?: string; view: CountryView; picked: readonly string[]; onDone: () => void }) {
  const [metrics, setMetrics] = useState<Indicator[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  /** null until a group is folded or unfolded by hand. */
  const [open, setOpen] = useState<ReadonlySet<string> | null>(null);
  // Searching opens every match; folding one lasts until the query changes.
  const [folded, setFolded] = useState<{ query: string; ids: ReadonlySet<string> }>({ query: '', ids: new Set() });
  useEffect(() => {
    // A projection comes with the estimates it extends, never on its own.
    view.catalogue().then(all => setMetrics(withProjections(all)), () => setFailed(true));
  }, [view]);
  // The panel scrolls too; show the whole list once it has rows.
  useEffect(() => { if (metrics) root.current?.scrollIntoView({ block: 'nearest' }); }, [metrics]);
  useEffect(() => { list.current?.scrollTo({ top: 0 }); }, [query]);

  const suggested = useMemo(() => metrics && suggestedGroup(metrics), [metrics]);
  const topical = useMemo(() => (metrics ? groupIndicators(metrics) : []), [metrics]);
  const searching = query.trim().length > 0;
  const shown = useMemo(() => {
    if (searching) return filterIndicators(topical, query);
    return suggested?.count ? [suggested, ...topical] : topical;
  }, [searching, topical, query, suggested]);
  const matches = searching ? shown.reduce((n, g) => n + g.count, 0) : 0;

  const full = picked.length >= MAX_PICKS;
  // Picks from outside the suggestions open their own groups, so they show checked.
  const defaults = useMemo(() => {
    const ids = new Set([SUGGESTED]);
    const curated = new Set(suggested?.sections.flatMap(s => s.metrics.map(m => m.code)));
    for (const m of metrics ?? []) if (picked.includes(m.code) && !curated.has(m.code)) ids.add(placeOf(m.topic).group);
    return ids;
  }, [metrics, picked, suggested]);
  const foldedNow = folded.query === query ? folded.ids : null;
  const isOpen = (gid: string) => (searching ? !foldedNow?.has(gid) : (open ?? defaults).has(gid));
  const setGroupOpen = (gid: string, value: boolean) => {
    const flip = (ids: ReadonlySet<string>, add: boolean) => {
      const next = new Set(ids);
      if (add) next.add(gid);
      else next.delete(gid);
      return next;
    };
    if (searching) setFolded({ query, ids: flip(foldedNow ?? new Set(), !value) });
    else setOpen(prev => flip(prev ?? defaults, value));
  };

  return (
    <div id={id} ref={root}>
      <SearchField value={q} onChange={setQ} autoFocus label="Search indicators" autoComplete="off" spellCheck={false}
        placeholder={metrics ? `Search ${metrics.length.toLocaleString('en')} indicators` : 'Loading indicators…'}
        onKeyDown={e => {
          if (e.key !== 'Escape' || q) return;
          e.preventDefault();
          onDone();
        }} />
      {failed && <p className="mt-2 text-meta text-red">Couldn&apos;t load the indicator list.</p>}
      {full && <p role="status" className="mt-2 text-meta text-ink-3">That&apos;s {MAX_PICKS}, the most at once. Remove one to add another.</p>}
      {metrics && (
        <div ref={list} className="styled-scrollbar -mx-2 mt-2 max-h-96 overflow-y-auto px-2">
          {searching && matches > 0 && <p role="status" className="mb-1 text-meta text-ink-3">{matches === 1 ? '1 indicator matches' : `${matches.toLocaleString('en')} indicators match`}</p>}
          {searching && !matches && (
            <EmptyState icon={SearchX} title={`No indicator matches “${query.trim()}”`}
              body="Search matches names, codes and topics, such as debt, literacy or SP.POP." />
          )}
          <div>
            {shown.map(g => (
              <Disclosure key={g.id} title={g.title} hint={g.count.toLocaleString('en')} open={isOpen(g.id)} onOpenChange={o => setGroupOpen(g.id, o)}>
                {g.sections.map(s => (
                  <div key={s.label ?? ''} className="not-first:mt-3">
                    {s.label && <h4 className="pt-1 pb-1 text-meta font-medium text-ink-3">{s.label}</h4>}
                    {s.metrics.map(m => {
                      const on = picked.includes(m.code);
                      return (
                        // Long names differ only at the end ("… (% of GNI)"), so they wrap instead of truncating.
                        <ListRow key={m.code} compact disabled={full && !on} aria-label={`${on ? 'Remove' : 'Add'} ${m.name}`}
                          leading={<Check aria-hidden strokeWidth={2} className={cx('size-4 text-accent', !on && 'invisible')} />}
                          title={<span className="line-clamp-2 whitespace-normal">{m.years ? undated(m.name) : m.name}</span>}
                          subtitle={(
                            <span className="text-meta text-ink-3">
                              {m.years && <><span className="font-mono tabular-nums">{yearSpan(m.years, m.projectedTo)}</span> · </>}
                              <span className="font-mono tabular-nums">{m.subjects.toLocaleString('en')}</span> countries
                            </span>
                          )}
                          onClick={() => (on ? view.remove(m.code) : view.select(m.code))} />
                      );
                    })}
                  </div>
                ))}
              </Disclosure>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
