'use client';

import { X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import type { ChartedCountry } from '@/lib/history/countries/chart';
import { SERIES_INK } from '@/lib/map/style/tokens';

/** A short stroke in a country's chart colour, as its lines are drawn. */
export function LineKey({ slot }: { slot: number }) {
  return (
    <svg aria-hidden width="12" height="2" className="shrink-0">
      <line x1="0" x2="12" y1="1" y2="1" stroke={SERIES_INK[slot]} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/** The charts' legend: each country's line key and name, and a way to drop it from every chart. */
export function CountryKeys({ countries, onRemove }: { countries: ChartedCountry[]; onRemove: (key: string) => void }) {
  const t = useT();
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {countries.map(c => (
        <li key={c.key} className="flex min-w-0 items-center gap-1.5 text-small">
          <LineKey slot={c.slot} />
          <span className="max-w-[10rem] truncate text-ink-2">{c.name}</span>
          <IconButton size="sm" icon={X} label={t('Remove {name}', { name: c.name })} className="-ml-1" onClick={() => onRemove(c.key)} />
        </li>
      ))}
    </ul>
  );
}
