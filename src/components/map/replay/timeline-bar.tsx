'use client';

import { useReducer, useState } from 'react';
import { SEAL_DELAY_MS } from '@takip/core/tracks';
import { cx } from '@/components/ui/class-names';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { gapsWithin, type LayerSpans, missingAt, rangesFor, unionSpans } from '@/lib/map/replay/availability';
import type { ReplaySession } from '@/lib/map/replay/session';
import { formatTime, HISTORY_START, parseJump } from '@/lib/map/replay/time-input';
import { type GoToExample, GoToPopover } from './go-to-popover';
import { BackToLive, ChoiceMenu, JumpButton, PlayButton, TimeReadout } from './timeline-controls';
import { TimelineDock, TimelineRow } from './timeline-dock';
import TimelineScrubber from './timeline-scrubber';
import { calendarTicks } from '@/lib/map/replay/timeline-ticks';
import { useReplayTick } from './use-replay';
import { useRemembered } from './use-remembered';
import { useTimelineKeys } from './use-timeline-keys';

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
/** Simulated seconds per second, and what a jump of JUMP_S seconds of playback covers at each. */
const SPEEDS = [
  { value: 1, label: msg('Real time'), jump: msg('10 s') },
  { value: 10, label: msg('10 s / s'), jump: msg('100 s') },
  { value: 30, label: msg('30 s / s'), jump: msg('5 min') },
  { value: 60, label: msg('1 min / s'), jump: msg('10 min') },
  { value: 3600, label: msg('1 hour / s'), jump: msg('10 hours') },
  { value: 86_400, label: msg('1 day / s'), jump: msg('10 days') },
  { value: 30 * 86_400, label: msg('1 month / s'), jump: msg('10 months') },
  { value: 365 * 86_400, label: msg('1 year / s'), jump: msg('10 years') },
];
const JUMP_S = 10;
/** How much history the track spans, ending now. */
const RANGES = [
  { id: 'day', label: msg('Last 24 hours'), ms: DAY_MS },
  { id: 'month', label: msg('Last 30 days'), ms: 30 * DAY_MS },
  { id: 'year', label: msg('Last year'), ms: YEAR_MS },
  { id: 'century', label: msg('Last 100 years'), ms: 100 * YEAR_MS },
  { id: 'all', label: msg('All of history'), ms: Number.POSITIVE_INFINITY },
] as const;
/** The last choice when no range above fits the oldest data of the layers on: from there to now. */
const RECORDED = { id: 'recorded', label: msg('All recorded'), ms: Number.POSITIVE_INFINITY } as const;
type RangeId = (typeof RANGES)[number]['id'] | typeof RECORDED.id;

const STATE_TEXT = {
  loading: msg('Loading…'),
  zoom_in: msg('Zoom in to see tracks here'),
  nothing_recorded: msg('Nothing recorded at this time'),
  before_window: msg('Nothing recorded this far back'),
  nothing_selected: msg('Ships and flights are off in Layers'),
};

/** The smallest range that still shows `t`. */
const rangeFor = (t: number, now: number): RangeId => RANGES.find(r => now - t <= r.ms)?.id ?? 'all';

/** Over the track: which of the layers on hold nothing at `at`. */
function missingNote(layers: LayerSpans[], at: number, t: Translate) {
  const missing = missingAt(layers, at).map(label => t(label));
  if (!missing.length) return undefined;
  const note = t('{layers}: not recorded', { layers: new Intl.ListFormat(t.intl, { type: 'conjunction' }).format(missing) });
  return note.charAt(0).toLocaleUpperCase(t.intl) + note.slice(1);
}

/** The session's error in words: a browser's "Failed to fetch" means the server didn't answer. */
function errorText(message: string, t: Translate) {
  if (/fetch|network|load failed/i.test(message)) return t("Can't reach the replay server");
  const status = /HTTP (\d{3})/.exec(message)?.[1];
  return status ? t('The replay server is having trouble ({status})', { status }) : t('Replay unavailable: {message}', { message });
}

const pad = (n: number) => String(n).padStart(2, '0');
const clock24 = (d: Date, seconds = true) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${seconds ? `:${pad(d.getUTCSeconds())}` : ''}`;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The big number is the finest unit the range moves through: the time over a day, the date beyond. */
function readout(at: number, span: number, t: Translate) {
  const d = new Date(at);
  const date = formatTime(at, Number.POSITIVE_INFINITY, t);
  if (d.getUTCFullYear() <= 0) return { primary: date, secondary: '' };
  if (span <= 2 * DAY_MS) return { primary: clock24(d), secondary: `${date} · UTC` };
  return { primary: date, secondary: `${clock24(d, false)} UTC` };
}

function pointerText(ms: number, span: number, t: Translate) {
  const d = new Date(ms);
  if (d.getUTCFullYear() <= 0 || span > 400 * DAY_MS) return formatTime(ms, span, t);
  if (span <= 2 * DAY_MS) return clock24(d);
  return `${d.toLocaleDateString(t.intl, { day: 'numeric', month: 'short', timeZone: 'UTC' })} ${clock24(d, false)}`;
}

function examples(now: number, t: Translate): GoToExample[] {
  return [
    { label: t('Yesterday at noon'), value: `${ymd(now - DAY_MS)} 12:00` },
    { label: t('A week ago'), value: ymd(now - 7 * DAY_MS) },
    { label: t('New Year'), value: `${new Date(now).getUTCFullYear()}-01-01` },
  ];
}

/**
 * In place of the status bar while replay is on: play, the time, speed, the track with what was recorded, its range, "Go to" and the way back to live.
 * `compact` is the phone's two rows, without the range: jumping or going to an earlier time widens it.
 */
export default function TimelineBar({ session, onExit, compact }: { session: ReplaySession; onExit: () => void; compact?: boolean }) {
  const t = useT();
  const now = useReplayTick(session);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [rangeId, setRangeId] = useRemembered<RangeId>('takip.replay.range', 'day', [...RANGES.map(r => r.id), RECORDED.id]);
  const [goTo, setGoTo] = useState(false);
  const { clock } = session;
  const stats = session.stats();
  const time = clock.time();
  const hi = now || time;
  const layers = session.spans();
  const recorded = unionSpans(layers.map(l => l.spans));
  // The track reaches back to the oldest data of the layers on, and no further; a clock set earlier widens it.
  const oldest = recorded[0]?.from;
  const fit = rangesFor(RANGES, oldest, hi);
  const ranges = [...fit.shorter, fit.whole ?? RECORDED];
  const range = ranges.find(r => r.id === rangeId) ?? ranges.at(-1)!;
  const from = oldest !== undefined && range === ranges.at(-1) ? oldest : Number.isFinite(range.ms) ? hi - range.ms : HISTORY_START;
  const lo = Math.min(time, from);
  const span = hi - lo;
  const error = session.error();
  const { primary, secondary } = readout(time, span, t);

  const toggle = () => {
    if (clock.playing()) clock.pause();
    else clock.play();
    rerender();
  };
  const seek = (to: number) => {
    clock.seek(to);
    rerender();
  };
  const jump = (dir: -1 | 1) => {
    const to = Math.min(Date.now(), clock.time() + dir * JUMP_S * clock.speed() * 1000);
    clock.seek(to);
    if (to < lo) setRangeId(rangeFor(to, hi));
    rerender();
  };
  const jumpBy = SPEEDS.find(s => s.value === clock.speed())?.jump;
  const jumpSpan = jumpBy ? t(jumpBy) : t('{n} s of playback', { n: JUMP_S });
  useTimelineKeys(toggle, () => setGoTo(true), jump);

  const go = (text: string) => {
    const to = parseJump(text);
    if (to === undefined) return false;
    clock.seek(to);
    setRangeId(rangeFor(to, hi));
    return true;
  };

  const status = error ? errorText(error, t) : stats.state === 'ok' ? t('{n, plural, one {# track in view} other {# tracks in view}}', { n: stats.shown }) : t(STATE_TEXT[stats.state]);

  const play = <PlayButton playing={clock.playing()} onToggle={toggle} />;
  const back = <JumpButton dir={-1} span={jumpSpan} onJump={jump} />;
  const ahead = <JumpButton dir={1} span={jumpSpan} onJump={jump} />;
  const speed = <ChoiceMenu label={t('Speed')} value={clock.speed()} groups={[{ options: SPEEDS.map(s => ({ value: s.value, label: t(s.label) })) }]} onChange={x => { clock.setSpeed(x); rerender(); }} />;
  const scrubber = (
    <TimelineScrubber label={t('Replay time')} lo={lo} hi={hi} time={time} step={clock.speed() * 1000}
      onSeek={seek} onTogglePlay={toggle} format={ms => pointerText(ms, span, t)}
      ticksFor={max => calendarTicks(lo, hi, max, t)}
      gaps={layers.length ? gapsWithin(recorded, lo, hi) : []} provisionalFrom={hi - SEAL_DELAY_MS}
      noteAt={at => missingNote(layers, at, t)} notes={{ provisional: t('provisional until two hours old') }} />
  );
  const goToButton = (
    <GoToPopover open={goTo} onOpenChange={setGoTo} onGo={go} placeholder={`${ymd(hi - DAY_MS)} 14:30`}
      hint={t('Try a date such as {date}, or a date and time such as {date} 14:30.', { date: ymd(hi - DAY_MS) })}
      examples={examples(hi, t)} />
  );
  const exit = <BackToLive onExit={onExit} />;

  if (compact) {
    return (
      <TimelineDock label={t('Replay timeline')} compact
        above={error && <p role="status" className="rounded-card border border-line bg-surface-1 px-3 py-2 text-small text-red shadow-float">{status}</p>}>
        <TimelineRow>{play}<div className="min-w-0 flex-1 overflow-hidden"><TimeReadout primary={primary} secondary={secondary} /></div>{goToButton}{exit}</TimelineRow>
        <TimelineRow>{back}{scrubber}{ahead}{speed}</TimelineRow>
      </TimelineDock>
    );
  }

  // The strip under an open panel has room for the status; the bar shows it only when wide, or when it's an error.
  return (
    <TimelineDock label={t('Replay timeline')} status={<><Dot tone={error ? 'red' : 'muted'} />{t('Replay · {status}', { status: t.locale === 'en' ? status.charAt(0).toLowerCase() + status.slice(1) : status })}</>}>
      <div className="flex shrink-0 items-center gap-1">{back}{play}{ahead}</div>
      <TimeReadout className={span <= 2 * DAY_MS ? 'w-[124px]' : 'w-[154px]'} primary={primary} secondary={secondary} />
      {speed}
      {scrubber}
      <p role="status" title={error ?? undefined}
        className={cx('max-w-[220px] shrink-0 truncate text-small', error ? 'text-red' : 'hidden text-ink-3 @6xl/timeline:block')}>{status}</p>
      <div className="flex shrink-0 items-center gap-1">
        <ChoiceMenu label={t('Range')} value={range.id} groups={[{ options: ranges.map(r => ({ value: r.id, label: t(r.label) })) }]} onChange={setRangeId} />
        {goToButton}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        {exit}
      </div>
    </TimelineDock>
  );
}
