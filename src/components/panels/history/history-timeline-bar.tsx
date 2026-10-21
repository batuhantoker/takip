'use client';

import { useReducer, useState } from 'react';
import { allProjectedAt, projectedAt, projectionEnd } from '@/lib/history/projection';
import { msAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { atMa, formatMa, maAt, parseDeepJump, PERIODS, periodAt } from '@/lib/history/paleo/deep-time';
import { formatTime, parseJump } from '@/lib/map/replay/time-input';
import { GoToPopover } from '@/components/map/replay/go-to-popover';
import { BackToLive, type ChoiceGroup, ChoiceMenu, PlayButton, TimeReadout } from '@/components/map/replay/timeline-controls';
import { TimelineDock, TimelineRow } from '@/components/map/replay/timeline-dock';
import TimelineScrubber, { type Band } from '@/components/map/replay/timeline-scrubber';
import { calendarTicks, deepTicks } from '@/lib/map/replay/timeline-ticks';
import { useRemembered } from '@/components/map/replay/use-remembered';
import { useTimelineKeys } from '@/components/map/replay/use-timeline-keys';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
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
import { countAction } from '@/lib/platform/usage-actions';

/** The geological periods inside the deep range, oldest first, for the strip under the track. */
function periodBands(lo: number, hi: number): Band[] {
  return PERIODS.map((p, i) => ({ from: atMa(p.base), to: atMa(i ? PERIODS[i - 1].base : 0), color: p.color }))
    .filter(b => b.to > lo && b.from < hi)
    .map(b => ({ ...b, from: Math.max(b.from, lo) }))
    .reverse();
}

/** The age in display type; a paused clock drops a trailing ".0", so a chapter reads "1,800 Ma". */
const displayMa = (ma: number, playing: boolean, intl: string) => (playing ? formatMa(ma, intl) : formatMa(ma, intl).replace(/[.,]0+ /, ' '));

/**
 * In place of the status bar while History is on: play, the date, speed, the track, its range, "Go to" and the way back to live.
 * While the countries show projections the track runs past today to their end, the projected years marked.
 * `compact` is the phone's two rows, without the range: Go to and seeking earlier widen it.
 */
export default function HistoryTimelineBar({ session, onExit, compact }: { session: HistorySession; onExit: () => void; compact?: boolean }) {
  const t = useT();
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
  const seek = (to: number) => {
    hold();
    clock.seek(to);
    rerender();
  };
  useTimelineKeys(toggle, () => setGoTo(true));

  const go = (text: string) => {
    const age = parseDeepJump(text, t);
    const at = age === undefined ? parseJump(text) : undefined;
    if (age !== undefined) {
      session.setDeep(true);
      session.story.hold();
      session.deepClock.seek(atMa(age));
    } else if (at !== undefined) {
      if (projection && at > projectionEnd(projection)) return t('The projections end in {year}.', { year: String(projection.to) });
      if (!projection && at > openedAt) return t('History stops at today. To look ahead, colour countries by a metric with UN projections, such as median age.');
      session.setDeep(false);
      session.clock.seek(at);
    } else return false;
    countAction('history.jump');
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
    ? (x: number) => `${formatMa(maAt(x), t.intl)} · ${t(periodAt(maAt(x)).name)}`
    : (x: number) => formatTime(x, hi - lo, t);
  const translated = <V,>(groups: ChoiceGroup<V>[]) =>
    groups.map(g => ({ label: g.label && t(g.label), options: g.options.map(o => ({ ...o, label: t(o.label) })) }));

  let above = null;
  if (deep) above = <DeepTimeCard session={session} compact={compact} />;
  else if (session.layers().includes(WORLD_BORDERS.code)) above = <WorldBordersLegend session={session} compact={compact} />;
  else if (session.layers().length > 0) above = <WarLegend session={session} compact={compact} />;
  else if (session.countries.state().status !== 'off') above = <CountryLegend session={session} compact={compact} />;

  const play = <PlayButton playing={playing} onToggle={toggle} />;
  const readout = (
    <TimeReadout className={compact ? undefined : 'w-[154px]'}
      primary={deep ? displayMa(ma, clock.playing(), t.intl) : formatTime(time, Number.POSITIVE_INFINITY, t)}
      secondary={deep ? <><Swatch color={period.color} />{t(period.name)}</> : projectedAt(projection, time) ? <span title={projection!.label}>{allProjectedAt(projection, time) ? projection!.short : t('Some countries projected')}</span> : ago(time, openedAt, t.intl)} />
  );
  const speed = (
    <ChoiceMenu label={t('Speed')} value={clock.speed()} display={storyRunning ? t('Story pace') : speedLabel(clock.speed(), deep, t)}
      groups={translated([{ options: deep ? DEEP_SPEEDS : SPEEDS }])} className={compact ? 'max-w-32' : undefined}
      onChange={x => { hold(); clock.setSpeed(x); rerender(); }} />
  );
  const scrubber = (
    <TimelineScrubber label={deep ? t('Age') : t('Date')} lo={lo} hi={hi} time={time} step={clock.speed() * 1000}
      onSeek={seek} onTogglePlay={toggle} format={formatAt}
      ticksFor={max => (deep ? deepTicks(lo, hi, max, t) : calendarTicks(lo, hi, max, t))}
      bands={deep ? periodBands(lo, hi) : undefined}
      today={projection ? openedAt : undefined}
      provisionalFrom={projection ? msAt(projection.from) : undefined}
      notes={projection ? { provisional: projection.simulated ? projection.short : projection.label } : undefined} />
  );
  const goToButton = (
    <GoToPopover open={goTo} onOpenChange={setGoTo} onGo={go} title={t('Go to a date or age')}
      placeholder={projection ? '1916, 1939-09-01, 2050, 250 Ma' : '1916, 1939-09-01, 500 BCE, 250 Ma'}
      hint={t('Try a year, a date such as 1939-09-01, or an age such as 250 Ma or Jurassic.')}
      examples={GO_TO_EXAMPLES.map(x => ({ ...x, label: t(x.label) }))} />
  );
  const exit = <BackToLive onExit={onExit} />;

  return (
    <TimelineDock label={deep ? t('Deep time timeline') : t('History timeline')} above={above} compact={compact}
      status={<><Dot tone="muted" />{deep ? t('Deep time · live layers paused') : t('History · live layers paused')}</>}>
      {compact ? (
        <>
          <TimelineRow>{play}<div className="min-w-0 flex-1 overflow-hidden">{readout}</div>{goToButton}{exit}</TimelineRow>
          <TimelineRow>{scrubber}{speed}</TimelineRow>
        </>
      ) : (
        <>
          {play}
          {readout}
          {speed}
          {scrubber}
          <div className="flex shrink-0 items-center gap-1">
            <ChoiceMenu label={t('Range')} value={deep ? deepRange.id : range.id} groups={translated(RANGE_GROUPS)} onChange={pickRange} />
            {goToButton}
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            {exit}
          </div>
        </>
      )}
    </TimelineDock>
  );
}
