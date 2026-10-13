'use client';

import { cx, FOCUS_RING, TRANSITION, type Tone } from '@/components/ui/class-names';
import { Stat } from '@/components/ui/stat';
import { Tooltip } from '@/components/ui/tooltip';
import type { QuakeAlert } from '@/lib/alerts/live-alerts';
import { magnitude } from '@/components/panels/alerts/format';

export type StatPick = 'severe' | 'rocket' | 'breaking' | 'quake';

export type RightNow = { severe: number; rockets: number; breaking: number; biggest: QuakeAlert | null };

/**
 * What a reader wants before reading anything: warnings in force, rockets,
 * breaking reports, the largest quake. Each is a filter, because the next thing
 * anybody does with that number is go and look at it.
 */
export default function AlertSummary({ rightNow, active, onPick }: {
  rightNow: RightNow;
  active: StatPick | null;
  onPick: (pick: StatPick) => void;
}) {
  const { severe, rockets, breaking, biggest } = rightNow;
  const quakeTone: Tone = !biggest ? 'neutral' : biggest.magnitude >= 6 ? 'red' : biggest.magnitude >= 5 ? 'amber' : 'neutral';
  // Dozens of severe warnings are always in force, so a red count there would never switch off.
  const stats: { key: StatPick; label: string; value: string; tone: Tone; hint: string }[] = [
    { key: 'severe', label: 'Severe', value: String(severe), tone: 'neutral', hint: 'Warnings in force graded severe or extreme' },
    { key: 'rocket', label: 'Rockets', value: String(rockets), tone: rockets ? 'red' : 'neutral', hint: 'Rocket or missile reports in the last 6 h' },
    { key: 'breaking', label: 'Breaking', value: String(breaking), tone: 'neutral', hint: 'Reports a channel flagged as breaking in the last 6 h' },
    {
      key: 'quake',
      label: 'Largest quake',
      value: biggest ? magnitude(biggest) : '–',
      tone: quakeTone,
      hint: biggest ? `Largest in the last day: ${biggest.place}` : 'No earthquakes in the last day',
    },
  ];

  return (
    <div role="group" aria-label="Right now" className="-mx-2 grid grid-cols-[1fr_1fr_1fr_1.35fr] gap-1">
      {stats.map(s => {
        const on = active === s.key;
        return (
          <Tooltip key={s.key} label={s.hint} side="bottom">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onPick(s.key)}
              className={cx(
                'min-w-0 rounded-card px-2 py-1.5 text-left',
                on ? 'bg-surface-3' : 'hover:bg-surface-2',
                FOCUS_RING,
                TRANSITION,
              )}
            >
              <Stat size="sm" label={s.label} value={s.value} tone={s.tone} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
