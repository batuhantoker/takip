'use client';

import { Fragment, type ReactNode } from 'react';
import { ChevronDown, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { MenuDivider, MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { Dot } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/components/ui/use-t';

/** The timeline's main control: round, a size up from the icon buttons around it. */
export function PlayButton({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  const t = useT();
  const Icon = playing ? Pause : Play;
  const label = playing ? t('Pause') : t('Play');
  return (
    <Tooltip label={label} kbd="Space">
      <button type="button" onClick={onToggle} aria-label={label} aria-keyshortcuts="Space"
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-ink-1 hover:bg-surface-3 active:bg-surface-3',
          FOCUS_RING,
          TRANSITION,
        )}>
        <Icon aria-hidden className={cx('size-4', !playing && 'translate-x-px')} strokeWidth={1.75} fill="currentColor" />
      </button>
    </Tooltip>
  );
}

/** Back or ahead by `span` ("10 min"), either side of the play button. */
export function JumpButton({ dir, span, onJump }: { dir: -1 | 1; span: string; onJump: (dir: -1 | 1) => void }) {
  const t = useT();
  return (
    <IconButton label={dir < 0 ? t('Back {span}', { span }) : t('Ahead {span}', { span })} icon={dir < 0 ? RotateCcw : RotateCw} kbd={dir < 0 ? ',' : '.'}
      tooltipSide="top" onClick={() => onJump(dir)} />
  );
}

/** The time in display type, with one quiet line of context under it. */
export function TimeReadout({ primary, secondary, className }: { primary: string; secondary?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-w-0 shrink-0 flex-col', className)}>
      <span className="font-mono text-display font-medium whitespace-nowrap text-ink-1 tabular-nums">{primary}</span>
      <span className="flex h-3.5 min-w-0 items-center gap-1.5 truncate text-meta whitespace-nowrap text-ink-3">{secondary}</span>
    </div>
  );
}

export type Choice<V> = { value: V; label: string };
export type ChoiceGroup<V> = { label?: string; options: Choice<V>[] };

/** A compact pick-one menu: speed, range. The trigger shows the current choice. */
export function ChoiceMenu<V extends string | number>({ label, value, display, groups, onChange, className }: {
  /** Names the menu: "Speed". */
  label: string;
  value: V;
  /** What the trigger reads, when the value isn't one of the options. */
  display?: string;
  groups: ChoiceGroup<V>[];
  onChange: (value: V) => void;
  className?: string;
}) {
  const t = useT();
  const current = display ?? groups.flatMap(g => g.options).find(o => o.value === value)?.label ?? String(value);
  return (
    <Popover role="menu" label={label} placement="top" align="start" className="min-w-48 p-1"
      trigger={
        <Button variant="ghost" size="sm" aria-label={t('{label}: {value}', { label, value: current })} className={className}>
          <span className="truncate">{current}</span>
          <ChevronDown aria-hidden className="-mr-1 size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} />
        </Button>
      }>
      {close => groups.map((g, i) => (
        <Fragment key={g.label ?? i}>
          {i > 0 && <MenuDivider />}
          {g.label && <p className="px-2 pt-2 pb-1 text-meta font-medium text-ink-3">{g.label}</p>}
          {g.options.map(o => (
            <MenuItem key={o.value} selected={o.value === value} onSelect={() => { onChange(o.value); close(); }}>{o.label}</MenuItem>
          ))}
        </Fragment>
      ))}
    </Popover>
  );
}

export function BackToLive({ onExit }: { onExit: () => void }) {
  const t = useT();
  return (
    <Button size="sm" onClick={onExit}>
      <Dot tone="green" />
      {t('Back to live')}
    </Button>
  );
}
