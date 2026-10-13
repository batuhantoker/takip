'use client';

import { useId } from 'react';
import { TRANSITION, cx } from '@/components/ui/class-names';
import { Switch } from '@/components/ui/field';
import { Swatch } from './swatch';

/** A map layer to switch on or off, laid out as the Layers panel's rows: its colour, name, years, what it holds. The whole row flips the switch. */
export function ToggleRow({ color, title, span, note, checked, onChange }: {
  color: string;
  title: string;
  span?: string;
  note: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('-mx-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 hover:bg-surface-2', TRANSITION)}>
      <span className="flex size-4 shrink-0 items-center justify-center"><Swatch shape="dot" color={color} off={!checked} /></span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={cx('truncate text-body font-medium', checked ? 'text-ink-1' : 'text-ink-2')}>{title}</span>
          {span && <span className="ml-auto shrink-0 font-mono text-meta text-ink-3 tabular-nums">{span}</span>}
        </span>
        <span className="truncate text-meta text-ink-3">{note}</span>
      </span>
      <Switch id={id} label={title} hideLabel checked={checked} onChange={onChange} />
    </label>
  );
}
