'use client';

import { useId } from 'react';
import { cx, isNumeric, TRANSITION } from '@/components/ui/class-names';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/components/ui/use-t';
import type { ShownRow } from '@/components/shell/showing/lib/held-rows';
import { ShowingSwatch } from './showing-swatch';

const ROW = 'group/row relative -mx-2 flex items-center gap-3 rounded-control px-2 hover:bg-surface-2';
// The whole row is the target: a label or button stretched over it.
const STRETCH = 'after:absolute after:inset-0 after:rounded-control';

function Meta({ text }: { text?: string }) {
  if (!text) return null;
  return <span className={cx('shrink-0 text-meta text-ink-3', isNumeric(text) && 'font-mono tabular-nums')}>{text}</span>;
}

/** One thing on the map: its key, its name, and a switch to take it off (or back on) where it stands. */
export function ShowingRow({ row, tall, onSwitch, onOpen }: {
  row: ShownRow;
  /** Phones get 40 px rows to tap. */
  tall: boolean;
  onSwitch: (on: boolean) => void;
  /** For rows with no switch: opens the panel that holds them. */
  onOpen?: () => void;
}) {
  const t = useT();
  const id = useId();
  const size = tall ? 'min-h-10' : 'min-h-8';
  const name = cx('min-w-0 flex-1 truncate text-left text-body', row.on ? 'text-ink-1' : 'text-ink-3');

  if (!row.off) {
    return (
      <li className={cx(ROW, size, TRANSITION)}>
        <ShowingSwatch swatch={row.swatch} on />
        {onOpen
          ? <button type="button" onClick={onOpen} className={cx(name, STRETCH, 'outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent')}>{row.label}</button>
          : <span className={name}>{row.label}</span>}
        <Meta text={row.meta} />
        {row.value !== undefined && <span className="shrink-0 font-mono text-small text-ink-2 tabular-nums">{row.value.toLocaleString(t.intl)}</span>}
      </li>
    );
  }
  return (
    <li className={cx(ROW, size, TRANSITION)}>
      <ShowingSwatch swatch={row.swatch} on={row.on} />
      <label htmlFor={id} className={cx(name, STRETCH, 'cursor-pointer')}>{row.label}</label>
      <Meta text={row.meta} />
      <Switch id={id} size="sm" label={row.label} hideLabel checked={row.on} onChange={onSwitch} className="relative z-[1]" />
    </li>
  );
}
