'use client';

import { useReducer, useState } from 'react';
import { allProjectedAt, projectedAt, projectionEnd } from '@/lib/history/projection';
import { msAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { atMa, formatMa, maAt, parseDeepJump, PERIODS, periodAt } from '@/lib/history/paleo/deep-time';
import { formatTime, parseJump } from '@/lib/map/replay/time-input';
import { GoToPopover } from '@/components/map/replay/go-to-popover';
import { BackToLive, ChoiceMenu, PlayButton, TimeReadout } from '@/components/map/replay/timeline-controls';
import { TimelineDock } from '@/components/map/replay/timeline-dock';
import TimelineScrubber, { type Band } from '@/components/map/replay/timeline-scrubber';
import { calendarTicks, deepTicks } from '@/lib/map/replay/timeline-ticks';
import { useRemembered } from '@/components/map/replay/use-remembered';
import { useTimelineKeys } from '@/components/map/replay/use-timeline-keys';
import { Dot } from '@/components/ui/tag';
import CountryLegend from '@/components/panels/history/legends/country-legend';
import DeepTimeCard from '@/components/panels/history/legends/deep-time-card';
import { ago } from '@/components/panels/history/lib/format-date';
import {
  DEEP_RANGES, DEEP_SPEEDS, type DeepRangeId, GO_TO_EXAMPLES, isDeepRange, RANGE_GROUPS, RANGES, type RangeId, SPEEDS, speedLabel,
} from '@/components/panels/history/lib/history-timeline-config';
import { Swatch } from '@/components/panels/history/parts/swatch';
import { useHistoryTick } from './use-history';
import WarLegend from '@/components/panels/history/legends/war-legend';
import WorldBordersLegend from '@/components/panels/history/legends/world-borders-legend';
import { WORLD_BORDERS } from '@/lib/history/world-borders';

/** The geological periods inside the deep range, oldest first, for the strip under the track. */
function periodBands(lo: number, hi: number): Band[] {
  return PERIODS.map((p, i) => ({ from: atMa(p.base), to: atMa(i ? PERIODS[i - 1].base : 0), color: p.color }))
    .filter(b => b.to > lo && b.from < hi)
    .map(b => ({ ...b, from: Math.max(b.from, lo) }))
    .reverse();
}

/** The age in display type; a paused clock drops a trailing ".0", so a chapter reads "1,800 Ma". */
const displayMa = (ma: number, playing: boolean) => (playing ? formatMa(ma) : formatMa(ma).replace(/\.0+ /, ' '));

/**
 * In place of the status bar while History is on: play, the date, speed, the track, its range, "Go to" and the way back to live.
 * While the countries show projections the track runs past today to their end, the projected years marked.
 */
export default function HistoryTimelineBar({ session, onExit }: { session: HistorySession; onExit: () => void }) {
  useHistoryTick(session);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [rangeId, setRangeId] = useRemembered<RangeId>('takip.history.range', '1900', RANGES.map(r => r.id));
  const [deepRangeId, setDeepRangeId] = useRemembered<DeepRangeId>('takip.history.deep-range', 'ma540', DEEP_RANGES.map(r => r.id));
  const [goTo, setGoTo] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const deep = session.deep();
  const clock = deep ? session.deepClock : session.clock;
  const time = clock.time();
  const projection = deep ? null : session.countries.projection();
  const hi = deep ? 0 : projection ? projectionEnd(projection) : openedAt;
  // A time before the chosen range shows the smallest range that reaches it, without forgetting the choice.
  const chosen = RANGES.find(r => r.id === rangeId)!;
  const range = chosen.from <= time ? chosen : RANGES.find(r => r.from <= time) ?? RANGES[RANGES.length - 1];
  const deepChosen = DEEP_RANGES.find(r => r.id === deepRangeId)!;
  const deepRange = atMa(deepChosen.ma) <= time ? deepChosen : DEEP_RANGES.find(r => atMa(r.ma) <= time) ?? DEEP_RANGES[DEEP_RANGES.length - 1];
  const lo = deep ? atMa(deepRange.ma) : range.from;
  const ma = maAt(time);
  const period = periodAt(ma);
  // Taking the deep clock in hand stops the documentary running it.
  const hold = () => { if (deep) session.story.hold(); };
  // While the story runs, the clock rests on each chapter; the button follows the story, not the clock.
  const storyRunning = deep && session.story.index() !== null && session.story.auto();
  const playing = storyRunning || clock.playing();

  const toggle = () => {
    hold();
    if (playing) clock.pause();
    else clock.play();
    rerender();
  };
  const seek = (t: number) => {
    hold();
    clock.seek(t);
    rerender();
  };
  useTimelineKeys(toggle, () => setGoTo(true));

  const go = (text: string) => {
    const age = parseDeepJump(text);
    const t = age === undefined ? parseJump(text) : undefined;
    if (age !== undefined) {
      session.setDeep(true);
      session.story.hold();
      session.deepClock.seek(atMa(age));
    } else if (t !== undefined) {
      if (projection && t > projectionEnd(projection)) return `The projections end in ${projection.to}.`;
      if (!projection && t > openedAt) return 'History stops at today. To look ahead, colour countries by a metric with UN projections, such as median age.';
      session.setDeep(false);
      session.clock.seek(t);
    } else return false;
    rerender();
    return true;
  };

  const pickRange = (id: string) => {
    if (!isDeepRange(id)) {
      setRangeId(id as RangeId);
      session.setDeep(false);
      return;
    }
    setDeepRangeId(id);
    if (deep) return;
    // Into deep time from the calendar: start at the range's far end, moving.
    session.setDeep(true);
    session.deepClock.seek(atMa(DEEP_RANGES.find(r => r.id === id)!.ma));
    session.deepClock.play();
  };

  const formatAt = deep
    ? (t: number) => `${formatMa(maAt(t))} · ${periodAt(maAt(t)).name}`
    : (t: number) => formatTime(t, hi - lo);

  let above = null;
  if (deep) above = <DeepTimeCard session={session} />;
  else if (session.layers().includes(WORLD_BORDERS.code)) above = <WorldBordersLegend session={session} />;
  else if (session.layers().length > 0) above = <WarLegend session={session} />;
  else if (session.countries.state().status !== 'off') above = <CountryLegend session={session} />;

  return (
    <TimelineDock label={deep ? 'Deep time timeline' : 'History timeline'} above={above}
      status={<><Dot tone="muted" />{deep ? 'Deep time' : 'History'} · live layers paused</>}>
      <PlayButton playing={playing} onToggle={toggle} />
      <TimeReadout className="w-[154px]"
        primary={deep ? displayMa(ma, clock.playing()) : formatTime(time, Number.POSITIVE_INFINITY)}
        secondary={deep ? <><Swatch color={period.color} />{period.name}</> : projectedAt(projection, time) ? <span title={projection!.label}>{allProjectedAt(projection, time) ? projection!.short : 'Some countries projected'}</span> : ago(time, openedAt)} />
      <ChoiceMenu label="Speed" value={clock.speed()} display={storyRunning ? 'Story pace' : speedLabel(clock.speed(), deep)}
        groups={[{ options: deep ? DEEP_SPEEDS : SPEEDS }]}
        onChange={x => { hold(); clock.setSpeed(x); rerender(); }} />
      <TimelineScrubber label={deep ? 'Age' : 'Date'} lo={lo} hi={hi} time={time} step={clock.speed() * 1000}
        onSeek={seek} onTogglePlay={toggle} format={formatAt}
        ticksFor={max => (deep ? deepTicks(lo, hi, max) : calendarTicks(lo, hi, max))}
        bands={deep ? periodBands(lo, hi) : undefined}
        today={projection ? openedAt : undefined}
        provisionalFrom={projection ? msAt(projection.from) : undefined}
        notes={projection ? { provisional: projection.simulated ? projection.short : projection.label } : undefined} />
      <div className="flex shrink-0 items-center gap-1">
        <ChoiceMenu label="Range" value={deep ? deepRange.id : range.id} groups={RANGE_GROUPS} onChange={pickRange} />
        <GoToPopover open={goTo} onOpenChange={setGoTo} onGo={go} title="Go to a date or age"
          placeholder={projection ? '1916, 1939-09-01, 2050, 250 Ma' : '1916, 1939-09-01, 500 BCE, 250 Ma'}
          hint="Try a year, a date such as 1939-09-01, or an age such as 250 Ma or Jurassic."
          examples={GO_TO_EXAMPLES} />
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <BackToLive onExit={onExit} />
      </div>
    </TimelineDock>
  );
}
