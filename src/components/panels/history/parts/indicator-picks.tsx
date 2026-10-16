'use client';

import { X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import type { CountryPick, CountryView } from '@/lib/history/countries/view';
import { nameOf, undated, yearSpan } from '@/lib/history/countries/indicator-groups';
import { startsTogether } from '@/lib/history/projection';

/** The metrics picked: the one colouring the map marked, a click to colour by another, × to drop one. */
export function IndicatorPicks({ view, picks, coloured }: { view: CountryView; picks: CountryPick[]; coloured: string }) {
  return (
    <ul className="flex flex-col">
      {picks.map(p => {
        const name = nameOf(p);
        const on = p.code === coloured;
        let note;
        if (p.status === 'ready') {
          const { years, projection } = p.data;
          // The payload's years run to the projections' end; name where the estimates stop, or that none are measured.
          if (years) {
            const span = !projection ? yearSpan(years)
              : projection.simulated ? `${yearSpan(years)}, modelled`
                : startsTogether(projection) ? yearSpan([years[0], projection.from - 1], projection.to)
                  : `${yearSpan(years)}, projected by country`;
            note = <span className="font-mono text-meta text-ink-3 tabular-nums">{span}</span>;
          }
        }
        // The coloured pick's progress and errors show under the list.
        else if (!on) note = p.status === 'loading' ? 'Loading…' : <span className="text-red">{p.message}</span>;
        return (
          <li key={p.code}>
            <ListRow compact selected={on} aria-label={`Colour the map by ${name}`}
              leading={<span className={cx('size-2 rounded-full border', on ? 'border-accent bg-accent' : 'border-ink-3')} />}
              title={<span className="line-clamp-2 whitespace-normal">{p.status === 'ready' && p.data.years ? undated(name) : name}</span>} meta={on ? 'On the map' : undefined}
              subtitle={note}
              trailing={<IconButton size="sm" icon={X} label={`Remove ${name}`} onClick={() => view.remove(p.code)} />}
              onClick={on ? undefined : () => view.select(p.code)} />
          </li>
        );
      })}
    </ul>
  );
}
