import type { ReactNode } from 'react';
import { cx, type IconType, type Tone } from './class-names';

const TAG_TONE: Record<Tone, string> = {
  neutral: 'border-line-strong text-ink-2',
  accent: 'border-accent/35 text-accent',
  red: 'border-red/35 text-red',
  amber: 'border-amber/35 text-amber',
  green: 'border-green/35 text-green',
  blue: 'border-blue/35 text-blue',
};

/** A quiet, outlined attribute: "Severe", "ends in 16 h". Not a button; never a filled chip. */
export function Tag({ tone = 'neutral', icon: Icon, children, className }: { tone?: Tone; icon?: IconType; children: ReactNode; className?: string }) {
  return (
    <span className={cx(
      'inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] border px-1.5 text-meta leading-none font-medium whitespace-nowrap',
      TAG_TONE[tone],
      className,
    )}>
      {Icon && <Icon aria-hidden className="size-3" strokeWidth={2} />}
      {children}
    </span>
  );
}

export type DotTone = Tone | 'gold' | 'muted';

const DOT_TONE: Record<DotTone, string> = {
  neutral: 'bg-ink-2',
  muted: 'bg-ink-4',
  accent: 'bg-accent',
  red: 'bg-red',
  amber: 'bg-amber',
  green: 'bg-green',
  blue: 'bg-blue',
  gold: 'bg-gold',
};

/** A 6 px status dot. `pulse` for something live right now; `label` when the dot alone carries meaning. */
export function Dot({ tone = 'neutral', pulse, label, className }: { tone?: DotTone; pulse?: boolean; label?: string; className?: string }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx('relative inline-flex size-1.5 shrink-0', className)}
    >
      {pulse && (
        <span className={cx(
          'absolute inset-0 rounded-full opacity-60 animate-ping [animation-duration:1.8s] motion-reduce:hidden',
          DOT_TONE[tone],
        )} />
      )}
      <span className={cx('relative size-1.5 rounded-full', DOT_TONE[tone])} />
    </span>
  );
}
