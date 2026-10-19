'use client';

import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover } from '@/components/ui/popover';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';

export type Avoid = { tolls: boolean; highways: boolean; ferries: boolean };

const CHOICES: [keyof Avoid, string][] = [['tolls', msg('Tolls')], ['highways', msg('Motorways')], ['ferries', msg('Ferries')]];

/** What the route should keep away from, behind one quiet button that says how many are set. */
export default function RouteOptions({ avoid, toggleAvoid }: { avoid: Avoid; toggleAvoid: (k: keyof Avoid) => void }) {
  const t = useT();
  const set = CHOICES.filter(([k]) => avoid[k]).length;
  return (
    <Popover placement="bottom" align="end" label={t('Route options')} className="w-56 p-3"
      trigger={<Button variant="ghost" size="sm" icon={SlidersHorizontal}>{set ? t('Avoiding {n}', { n: set }) : t('Options')}</Button>}>
      <p className="mb-2.5 text-meta font-medium text-ink-3">{t('Avoid')}</p>
      <div className="flex flex-col gap-2.5">
        {CHOICES.map(([k, word], i) => (
          <Checkbox key={k} label={t(word)} checked={avoid[k]} onChange={() => toggleAvoid(k)} data-autofocus={i === 0 ? true : undefined} />
        ))}
      </div>
    </Popover>
  );
}
