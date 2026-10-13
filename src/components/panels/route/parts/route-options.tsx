'use client';

import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover } from '@/components/ui/popover';

export type Avoid = { tolls: boolean; highways: boolean; ferries: boolean };

const CHOICES: [keyof Avoid, string][] = [['tolls', 'Tolls'], ['highways', 'Motorways'], ['ferries', 'Ferries']];

/** What the route should keep away from, behind one quiet button that says how many are set. */
export default function RouteOptions({ avoid, toggleAvoid }: { avoid: Avoid; toggleAvoid: (k: keyof Avoid) => void }) {
  const set = CHOICES.filter(([k]) => avoid[k]).length;
  return (
    <Popover placement="bottom" align="end" label="Route options" className="w-56 p-3"
      trigger={<Button variant="ghost" size="sm" icon={SlidersHorizontal}>{set ? `Avoiding ${set}` : 'Options'}</Button>}>
      <p className="mb-2.5 text-meta font-medium text-ink-3">Avoid</p>
      <div className="flex flex-col gap-2.5">
        {CHOICES.map(([k, word], i) => (
          <Checkbox key={k} label={word} checked={avoid[k]} onChange={() => toggleAvoid(k)} data-autofocus={i === 0 ? true : undefined} />
        ))}
      </div>
    </Popover>
  );
}
