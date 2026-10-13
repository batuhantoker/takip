'use client';

import type { ReactNode } from 'react';
import { Undo2 } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { HEX_RE } from '@/lib/style/tokens';

/** "GEIST MONO" → "Geist mono"; the brand keeps its capitals. */
export const sentence = (s: string) => (s === 'TAKIP' ? s : s.charAt(0) + s.slice(1).toLowerCase());

/** A label on the left, its control on the right. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <span className="truncate text-body text-ink-2">{label}</span>
      {children}
    </div>
  );
}

/** Groups rows inside a section without starting a new one. */
export function SubHead({ label, note }: { label: string; note?: string }) {
  return (
    <div className="pt-3 pb-1">
      <p className="text-small font-medium text-ink-1">{label}</p>
      {note && <p className="text-meta text-ink-3">{note}</p>}
    </div>
  );
}

/** A colour, picked with the system picker; its hex beside it. Colours here are the user's data, hence inline. */
export function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative flex cursor-pointer items-center gap-2">
      <span className="font-mono text-meta text-ink-3 tabular-nums">{value}</span>
      <span className="size-6 shrink-0 rounded-control border border-line-strong" style={{ background: value }} />
      <input type="color" value={HEX_RE.test(value) ? value : '#000000'} onChange={e => onChange(e.target.value)}
        aria-label={label} className="absolute inset-0 cursor-pointer opacity-0" />
    </label>
  );
}

/**
 * A colour with a default it can be sent back to. Sitting on the default is
 * what keeps each satellite's own mission colour, so getting back to it must
 * not need a reset of the whole theme.
 */
export function ResettableSwatch({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (v: string) => void }) {
  const changed = value.toLowerCase() !== fallback.toLowerCase();
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(fallback)} aria-label={`Restore the default ${label.toLowerCase()}`} title="Restore the default"
        className={cx('flex size-6 items-center justify-center rounded-control text-ink-3 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION,
          !changed && 'pointer-events-none invisible')}>
        <Undo2 aria-hidden className="size-3.5" strokeWidth={1.75} />
      </button>
      <Swatch label={label} value={value} onChange={onChange} />
    </div>
  );
}

// Written out in full: Tailwind only sees class names that appear literally.
const RANGE = cx(
  'h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 disabled:cursor-not-allowed disabled:opacity-35',
  '[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink-1',
  '[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink-1',
  FOCUS_RING,
);

export function Slider({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="flex max-w-[168px] flex-1 items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} aria-label={label} className={RANGE} />
      <span className="w-10 text-right font-mono text-meta text-ink-3 tabular-nums">{format ? format(value) : value}</span>
    </div>
  );
}

/** A slider that can follow the app instead: Auto means "emit no rule", which leaves the app's own styling intact. */
export function AutoSlider({ label, value, min, max, step, whenEnabled, onChange, format }: {
  label: string; value: number | null; min: number; max: number; step: number;
  whenEnabled: number; onChange: (v: number | null) => void; format: (v: number) => string;
}) {
  const auto = value === null;
  return (
    <div className="flex max-w-[188px] flex-1 items-center gap-2">
      <button type="button" onClick={() => onChange(auto ? whenEnabled : null)} aria-pressed={auto}
        title={auto ? `${label} follows the app` : `${label} is set here`}
        className={cx('h-6 shrink-0 rounded-control px-1.5 text-meta font-medium', auto ? 'bg-surface-3 text-ink-1' : 'text-ink-3 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
        Auto
      </button>
      <input type="range" min={min} max={max} step={step} value={auto ? whenEnabled : value} disabled={auto}
        onChange={e => onChange(parseFloat(e.target.value))} aria-label={label} className={RANGE} />
      <span className="w-10 text-right font-mono text-meta text-ink-3 tabular-nums">{auto ? '' : format(value)}</span>
    </div>
  );
}
