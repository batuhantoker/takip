'use client';

import { useEffect } from 'react';
import { Circle, Earth, Pentagon, Spline, Square, type LucideIcon } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Tooltip } from '@/components/ui/tooltip';
import type { DrawMode } from '@/lib/places/areas/draw';
import { SHAPE_NAME } from '@/components/panels/areas/area-view';

// One line each at panel width; the pill over the map takes it from there.
const SHAPES: { mode: DrawMode; icon: LucideIcon; hint: string }[] = [
  { mode: 'polygon', icon: Pentagon, hint: 'Click each corner, then press Enter to close it.' },
  { mode: 'rectangle', icon: Square, hint: 'Click one corner, then the opposite one.' },
  { mode: 'circle', icon: Circle, hint: 'Click the centre, then where the edge goes.' },
  { mode: 'line', icon: Spline, hint: 'Click along the route, then press Enter to stop.' },
  { mode: 'region', icon: Earth, hint: 'Click a country, or zoom in to pick a state.' },
];

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Five shapes and one line on how to draw the chosen one. Keys 1 to 5 pick a shape while the panel is open. */
export default function ShapePicker({ mode, onChange, busy }: {
  mode: DrawMode | null;
  onChange: (mode: DrawMode | null) => void;
  /** A shape is half drawn: switching now would throw it away. */
  busy: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isEditable(e.target) || busy) return;
      const shape = SHAPES[Number(e.key) - 1];
      if (!shape) return;
      e.preventDefault();
      onChange(mode === shape.mode ? null : shape.mode);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onChange, busy]);

  const current = SHAPES.find(s => s.mode === mode);

  return (
    <div>
      <div role="group" aria-label="Shape" className="grid grid-cols-5 gap-1.5">
        {SHAPES.map(({ mode: m, icon: Icon }, i) => {
          const on = mode === m;
          const name = SHAPE_NAME[m];
          const label = busy ? 'Finish or cancel this shape first' : on ? 'Stop drawing' : `Draw ${name === 'Area' ? 'an area' : `a ${name.toLowerCase()}`}`;
          return (
            <Tooltip key={m} label={label} kbd={busy ? undefined : String(i + 1)}>
              <button
                type="button"
                aria-pressed={on}
                aria-disabled={busy || undefined}
                onClick={() => { if (!busy) onChange(on ? null : m); }}
                className={cx(
                  'flex h-14 min-w-0 flex-col items-center justify-center gap-1.5 rounded-card border text-meta font-medium',
                  on ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line text-ink-2',
                  busy ? (on ? 'cursor-default' : 'cursor-not-allowed opacity-40') : !on && 'hover:bg-surface-2 hover:text-ink-1',
                  FOCUS_RING,
                  TRANSITION,
                )}
              >
                <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                {name}
              </button>
            </Tooltip>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-2 text-small text-ink-2">
        {current ? current.hint : 'Pick a shape and click the map, or press 1 to 5.'}
      </p>
    </div>
  );
}
