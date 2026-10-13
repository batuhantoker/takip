'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION, type IconType } from './class-names';

export type SegmentedOption<V extends string> = {
  value: V;
  label: ReactNode;
  icon?: IconType;
  count?: number | string;
  disabled?: boolean;
};

export type SegmentedProps<V extends string> = {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: 'sm' | 'md';
  full?: boolean;
  /** Names the group for screen readers. */
  label?: string;
  /** 'tabs' when it switches what a panel shows; give it `id` so the panel can point back. */
  semantics?: 'radio' | 'tabs';
  id?: string;
  className?: string;
};

export const segmentId = (id: string, value: string) => `${id}-${value}`;

/** Two to five mutually exclusive choices, side by side. */
export function Segmented<V extends string>({ options, value, onChange, size = 'md', full, label, semantics = 'radio', id, className }: SegmentedProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs = semantics === 'tabs';

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const n = options.length;
    const moves: Record<string, [number, number]> = {
      ArrowRight: [i, 1], ArrowDown: [i, 1], ArrowLeft: [i, -1], ArrowUp: [i, -1], Home: [-1, 1], End: [n, -1],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    let [next] = move;
    do next = (next + move[1] + n) % n;
    while (options[next].disabled && next !== i);
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role={tabs ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={cx(
        'items-center gap-0.5 rounded-card border border-line bg-surface-0 p-0.5',
        full ? 'flex w-full' : 'inline-flex',
        size === 'md' ? 'h-8' : 'h-7',
        className,
      )}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role={tabs ? 'tab' : 'radio'}
            id={id ? segmentId(id, o.value) : undefined}
            aria-selected={tabs ? on : undefined}
            aria-checked={tabs ? undefined : on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cx(
              'inline-flex h-full min-w-0 items-center justify-center gap-1.5 rounded-control px-2.5 font-medium whitespace-nowrap',
              'disabled:cursor-not-allowed disabled:opacity-40',
              size === 'md' ? 'text-body' : 'text-small',
              full && 'flex-1',
              on ? 'bg-surface-3 text-ink-1 ring-1 ring-inset ring-line' : 'text-ink-3 hover:text-ink-1',
              FOCUS_RING,
              TRANSITION,
            )}
          >
            {Icon && <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />}
            <span className="truncate">{o.label}</span>
            {o.count != null && <span className="font-mono text-meta font-normal text-ink-3 tabular-nums">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
