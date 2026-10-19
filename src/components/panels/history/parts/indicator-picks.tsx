'use client';

import { X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { useT } from '@/components/ui/use-t';
import type { CountryPick, CountryView } from '@/lib/history/countries/view';
import { nameOf, yearSpan } from '@/lib/history/countries/indicator-groups';
import { startsTogether } from '@/lib/history/projection';

/** The metrics picked: the one colouring the map marked, a click to colour by another, × to drop one. */
export function IndicatorPicks({ view, picks, coloured }: { view: CountryView; picks: CountryPick[]; coloured: string }) {
  const t = useT();
  return (
    <ul className="flex flex-col">
      {picks.map(p => {
        const name = nameOf(p, false, t);
        const on = p.code === coloured;
        let note;
        if (p.status === 'ready') {
          const { years, projection } = p.data;
          // The payload's years run to the projections' end; name where the estimates stop, or that none are measured.
          if (years) {
            const span = !projection ? yearSpan(years, undefined, t)
              : projection.simulated ? t('{years}, modelled', { years: yearSpan(years, undefined, t) })
                : startsTogether(projection) ? yearSpan([years[0], projection.from - 1], projection.to, t)
                  : t('{years}, projected by country', { years: yearSpan(years, undefined, t) });
            note = <span className="font-mono text-meta text-ink-3 tabular-nums">{span}</span>;
          }
        }
        // The coloured pick's progress and errors show under the list.
        else if (!on) note = p.status === 'loading' ? t('Loading…') : <span className="text-red">{p.message}</span>;
        return (
          <li key={p.code}>
            <ListRow compact selected={on} aria-label={t('Colour the map by {name}', { name })}
              leading={<span className={cx('size-2 rounded-full border', on ? 'border-accent bg-accent' : 'border-ink-3')} />}
              title={<span className="line-clamp-2 whitespace-normal">{p.status === 'ready' && p.data.years ? nameOf(p, false, t, false) : name}</span>} meta={on ? t('On the map') : undefined}
              subtitle={note}
              trailing={<IconButton size="sm" icon={X} label={t('Remove {name}', { name })} onClick={() => view.remove(p.code)} />}
              onClick={on ? undefined : () => view.select(p.code)} />
          </li>
        );
      })}
    </ul>
  );
}
