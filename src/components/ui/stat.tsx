import type { ReactNode } from 'react';
import { cx, type Tone } from './class-names';

const VALUE_TONE: Record<Tone | 'gold', string> = {
  neutral: 'text-ink-1',
  accent: 'text-accent',
  red: 'text-red',
  amber: 'text-amber',
  green: 'text-green',
  blue: 'text-blue',
  gold: 'text-gold',
};

/** A number worth reading at a glance: label above, mono value, an optional change beside it. */
export function Stat({ label, value, unit, delta, deltaTone = 'neutral', tone = 'neutral', size = 'md', className }: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  delta?: ReactNode;
  deltaTone?: Tone;
  /** Colours the value; keep it neutral unless the number is a severity. */
  tone?: Tone | 'gold';
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1', className)}>
      <span className="truncate text-meta font-medium text-ink-3">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className={cx(
          'font-mono font-medium tabular-nums',
          size === 'md' ? 'text-display' : 'text-title',
          VALUE_TONE[tone],
        )}>
          {value}
        </span>
        {unit && <span className="text-small text-ink-3">{unit}</span>}
        {delta != null && (
          <span className={cx('font-mono text-meta tabular-nums', deltaTone === 'neutral' ? 'text-ink-3' : VALUE_TONE[deltaTone])}>{delta}</span>
        )}
      </span>
    </div>
  );
}
