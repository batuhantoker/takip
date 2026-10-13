'use client';

import { useId, type CSSProperties } from 'react';
import { Check, SlidersHorizontal, Trash2 } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { MenuDivider, MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import type { ImportedLayer } from '@/lib/layers/arcgis';
import { layerSwatches } from './arcgis-palette';

// The kit has no slider yet: a native range, drawn as a thin track filled with the accent up to the value.
const SLIDER = cx(
  'h-4 w-full cursor-pointer appearance-none rounded-full bg-transparent',
  '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full',
  '[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--accent)_var(--fill),var(--surface-3)_var(--fill))]',
  '[&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink-1',
  '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-surface-3',
  '[&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-accent',
  '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink-1',
);

/** Colour, opacity and removal for one imported layer. */
export function ArcgisLayerOptions({ layer, onUpdate, onRemove }: {
  layer: ImportedLayer;
  onUpdate: (updates: Partial<{ color: string; opacity: number }>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const pct = Math.round(layer.opacity * 100);
  return (
    <Popover
      placement="bottom"
      align="end"
      label={`${layer.title} options`}
      className="w-60 p-1"
      trigger={
        // A bare button, not IconButton: its Tooltip wrapper is display:contents, which leaves Popover nothing to anchor to.
        <button type="button" aria-label="Layer options"
          className={cx('inline-flex size-7 items-center justify-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink-1 active:bg-surface-3', FOCUS_RING, TRANSITION)}>
          <SlidersHorizontal aria-hidden className="size-3.5" strokeWidth={1.75} />
        </button>
      }
    >
      {close => (
        <>
          <div className="px-2 pt-2 pb-3">
            <p className="mb-2 text-meta font-medium text-ink-3">Colour</p>
            <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1.5">
              {layerSwatches().map(({ name, color: c }) => {
                const on = layer.color === c;
                return (
                  <button key={c} type="button" role="radio" aria-checked={on} aria-label={name}
                    data-autofocus={on || undefined}
                    onClick={() => onUpdate({ color: c })}
                    className={cx('flex size-6 items-center justify-center rounded-full ring-1 ring-line-strong ring-inset', FOCUS_RING)}
                    style={{ background: c }}>
                    {on && <Check aria-hidden className="size-3.5 text-on-accent" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 mb-1.5 flex items-baseline justify-between">
              <label htmlFor={id} className="text-meta font-medium text-ink-3">Opacity</label>
              <span className="font-mono text-meta text-ink-2 tabular-nums">{pct}%</span>
            </div>
            <input id={id} type="range" min={10} max={100} step={5} value={pct}
              onChange={e => onUpdate({ opacity: Number(e.target.value) / 100 })}
              style={{ '--fill': `${((pct - 10) / 90) * 100}%` } as CSSProperties}
              className={cx(SLIDER, FOCUS_RING)} />
          </div>
          <MenuDivider />
          <div className="p-1">
            <MenuItem icon={Trash2} danger onSelect={() => { close(); onRemove(); }}>Remove from map</MenuItem>
          </div>
        </>
      )}
    </Popover>
  );
}
