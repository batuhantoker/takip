'use client';

import { useReducer, useState } from 'react';
import { SEAL_DELAY_MS } from '@takip/core/tracks';
import { cx } from '@/components/ui/class-names';
import { Dot } from '@/components/ui/tag';
import type { ReplaySession } from '@/lib/map/replay/session';
import { formatTime, HISTORY_START, parseJump } from '@/lib/map/replay/time-input';
import { type GoToExample, GoToPopover } from './go-to-popover';
import { BackToLive, ChoiceMenu, JumpButton, PlayButton, TimeReadout } from './timeline-controls';
import { TimelineDock } from './timeline-dock';
import TimelineScrubber, { coverageGaps } from './timeline-scrubber';
import { calendarTicks } from '@/lib/map/replay/timeline-ticks';
import { useReplayTick } from './use-replay';
import { useRemembered } from './use-remembered';
import { useTimelineKeys } from './use-timeline-keys';

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
/** Simulated seconds per second, and what a jump of JUMP_S seconds of playback covers at each. */
const SPEEDS = [
  { value: 1, label: 'Real time', jump: '10 s' },
  { value: 60, label: '1 min / s', jump: '10 min' },
  { value: 3600, label: '1 hour / s', jump: '10 hours' },
  { value: 86_400, label: '1 day / s', jump: '10 days' },
  { value: 30 * 86_400, label: '1 month / s', jump: '10 months' },
  { value: 365 * 86_400, label: '1 year / s', jump: '10 years' },
];
const JUMP_S = 10;
/** How much history the track spans, ending now. */
const RANGES = [
  { id: 'day', label: 'Last 24 hours', ms: DAY_MS },
  { id: 'month', label: 'Last 30 days', ms: 30 * DAY_MS },
  { id: 'year', label: 'Last year', ms: YEAR_MS },
  { id: 'century', label: 'Last 100 years', ms: 100 * YEAR_MS },
  { id: 'all', label: 'All of history', ms: Number.POSITIVE_INFINITY },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

const STATE_TEXT = {
  loading: 'Loading…',
  zoom_in: 'Zoom in to see tracks here',
  nothing_recorded: 'Nothing recorded at this time',
  before_window: 'Nothing recorded this far back',
  nothing_selected: 'Ships and flights are off in Layers',
};

/** The smallest range that still shows `t`. */
const rangeFor = (t: number, now: number): RangeId => RANGES.find(r => now - t <= r.ms)?.id ?? 'all';

/** The session's error in words: a browser's "Failed to fetch" means the server didn't answer. */
function errorText(message: string) {
  if (/fetch|network|load failed/i.test(message)) return "Can't reach the replay server";
  const status = /HTTP (\d{3})/.exec(message)?.[1];
  return status ? `The replay server is having trouble (${status})` : `Replay unavailable: ${message}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const clock24 = (d: Date, seconds = true) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${seconds ? `:${pad(d.getUTCSeconds())}` : ''}`;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The big number is the finest unit the range moves through: the time over a day, the date beyond. */
function readout(t: number, span: number) {
  const d = new Date(t);
  const date = formatTime(t, Number.POSITIVE_INFINITY);
  if (d.getUTCFullYear() <= 0) return { primary: date, secondary: '' };
  if (span <= 2 * DAY_MS) return { primary: clock24(d), secondary: `${date} · UTC` };
  return { primary: date, secondary: `${clock24(d, false)} UTC` };
}

function pointerText(t: number, span: number) {
  const d = new Date(t);
  if (d.getUTCFullYear() <= 0 || span > 400 * DAY_MS) return formatTime(t, span);
  if (span <= 2 * DAY_MS) return clock24(d);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${clock24(d, false)}`;
}

function examples(now: number): GoToExample[] {
  return [
    { label: 'Yesterday at noon', value: `${ymd(now - DAY_MS)} 12:00` },
    { label: 'A week ago', value: ymd(now - 7 * DAY_MS) },
    { label: 'New Year', value: `${new Date(now).getUTCFullYear()}-01-01` },
  ];
}

/** In place of the status bar while replay is on: play, the time, speed, the track with what was recorded, its range, "Go to" and the way back to live. */
export default function TimelineBar({ session, onExit }: { session: ReplaySession; onExit: () => void }) {
  const now = useReplayTick(session);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [rangeId, setRangeId] = useRemembered<RangeId>('takip.replay.range', 'day', RANGES.map(r => r.id));
  const [goTo, setGoTo] = useState(false);
  const { clock } = session;
  const manifest = session.manifest();
  const stats = session.stats();
  const time = clock.time();
  const hi = now || time;
  const range = RANGES.find(r => r.id === rangeId)!;
  const lo = Number.isFinite(range.ms) ? hi - range.ms : HISTORY_START;
  const span = hi - lo;
  const error = session.error();
  const { primary, secondary } = readout(time, span);

  const toggle = () => {
    if (clock.playing()) clock.pause();
    else clock.play();
    rerender();
  };
  const seek = (t: number) => {
    clock.seek(t);
    rerender();
  };
  const jump = (dir: -1 | 1) => {
    const t = Math.min(Date.now(), clock.time() + dir * JUMP_S * clock.speed() * 1000);
    clock.seek(t);
    if (t < lo) setRangeId(rangeFor(t, hi));
    rerender();
  };
  const jumpSpan = SPEEDS.find(s => s.value === clock.speed())?.jump ?? `${JUMP_S} s of playback`;
  useTimelineKeys(toggle, () => setGoTo(true), jump);

  const go = (text: string) => {
    const t = parseJump(text);
    if (t === undefined) return false;
    clock.seek(t);
    setRangeId(rangeFor(t, hi));
    return true;
  };

  const status = error ? errorText(error) : stats.state === 'ok' ? `${stats.shown.toLocaleString('en')} tracks in view` : STATE_TEXT[stats.state];

  // The strip under an open panel has room for the status; the bar shows it only when wide, or when it's an error.
  return (
    <TimelineDock label="Replay timeline" status={<><Dot tone={error ? 'red' : 'muted'} />Replay · {status.charAt(0).toLowerCase() + status.slice(1)}</>}>
      <div className="flex shrink-0 items-center gap-1">
        <JumpButton dir={-1} span={jumpSpan} onJump={jump} />
        <PlayButton playing={clock.playing()} onToggle={toggle} />
        <JumpButton dir={1} span={jumpSpan} onJump={jump} />
      </div>
      <TimeReadout className={span <= 2 * DAY_MS ? 'w-[124px]' : 'w-[154px]'} primary={primary} secondary={secondary} />
      <ChoiceMenu label="Speed" value={clock.speed()} groups={[{ options: SPEEDS }]} onChange={x => { clock.setSpeed(x); rerender(); }} />
      <TimelineScrubber label="Replay time" lo={lo} hi={hi} time={time} step={clock.speed() * 1000}
        onSeek={seek} onTogglePlay={toggle} format={t => pointerText(t, span)}
        ticksFor={max => calendarTicks(lo, hi, max)}
        gaps={coverageGaps(manifest?.coverage ?? [], lo, hi)} provisionalFrom={hi - SEAL_DELAY_MS}
        notes={{ gap: 'not recorded', provisional: 'provisional until two hours old' }} />
      <p role="status" title={error ?? undefined}
        className={cx('max-w-[220px] shrink-0 truncate text-small', error ? 'text-red' : 'hidden text-ink-3 @6xl/timeline:block')}>{status}</p>
      <div className="flex shrink-0 items-center gap-1">
        <ChoiceMenu label="Range" value={rangeId} groups={[{ options: RANGES.map(r => ({ value: r.id, label: r.label })) }]} onChange={setRangeId} />
        <GoToPopover open={goTo} onOpenChange={setGoTo} onGo={go} placeholder={`${ymd(hi - DAY_MS)} 14:30`}
          hint={`Try a date such as ${ymd(hi - DAY_MS)}, or a date and time such as ${ymd(hi - DAY_MS)} 14:30.`}
          examples={examples(hi)} />
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <BackToLive onExit={onExit} />
      </div>
    </TimelineDock>
  );
}
