'use client';

import { type FormEvent, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { HistorySession } from '@/lib/history/session';
import { atMa, formatMa, maAt, parseDeepJump } from '@/lib/paleo/deep-time';
import { formatTime, HISTORY_START, parseJump } from '@/lib/replay/time-input';
import TimelineScrubber from '@/components/replay/timeline-scrubber';
import CountryLegend from './country-legend';
import DeepTimeCard from './deep-time-card';
import WarLegend from './war-legend';
import { useHistoryTick } from './use-history';

const DAY_S = 86_400;
const SPEEDS = [
  { x: DAY_S, label: '1 day/s' },
  { x: 7 * DAY_S, label: '1 wk/s' },
  { x: 30 * DAY_S, label: '1 mo/s' },
  { x: 365 * DAY_S, label: '1 yr/s' },
  { x: 3650 * DAY_S, label: '10 yr/s' },
];
const yearStart = (year: number) => Date.UTC(year, 0, 1);
/** How far back the scrubber reaches, ending now. */
const RANGES = [
  { id: '2000', label: 'Since 2000', from: yearStart(2000) },
  { id: '1900', label: 'Since 1900', from: yearStart(1900) },
  { id: '1800', label: 'Since 1800', from: yearStart(1800) },
  { id: '1500', label: 'Since 1500', from: yearStart(1500) },
  { id: 'all', label: 'All', from: HISTORY_START },
] as const;
type RangeId = (typeof RANGES)[number]['id'];
/** Deep time's clock counts years, so its speeds are years per millisecond: 1000 is a million years a second. */
const DEEP_SPEEDS = [
  { x: 500, label: '0.5 Myr/s' },
  { x: 1000, label: '1 Myr/s' },
  { x: 5000, label: '5 Myr/s' },
  { x: 20_000, label: '20 Myr/s' },
  { x: 50_000, label: '50 Myr/s' },
];
const DEEP_RANGES = [
  { id: 'ma66', label: '66 million years', ma: 66 },
  { id: 'ma250', label: '250 million years', ma: 250 },
  { id: 'ma540', label: '540 million years', ma: 540 },
  { id: 'ma1800', label: '1.8 billion years', ma: 1800 },
] as const;
type DeepRangeId = (typeof DEEP_RANGES)[number]['id'];
const isDeepRange = (id: string): id is DeepRangeId => DEEP_RANGES.some(r => r.id === id);

const CONTROL = 'h-6 px-1.5 rounded-md bg-black/40 border border-white/10 text-[10.5px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold-primary)]/50';

/** Replaces the status bar while History is on: play, speed, the date, a jump box, a scrubber and the way back to live. */
export default function HistoryTimelineBar({ session, onExit }: { session: HistorySession; onExit: () => void }) {
  useHistoryTick(session);
  const [rangeId, setRangeId] = useState<RangeId>('1900');
  const [deepRangeId, setDeepRangeId] = useState<DeepRangeId>('ma540');
  const [jump, setJump] = useState('');
  const [jumpError, setJumpError] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const deep = session.deep();
  const clock = deep ? session.deepClock : session.clock;
  const time = clock.time();
  const hi = deep ? 0 : openedAt;
  // A time before the chosen range shows the smallest range that reaches it, without forgetting the choice.
  const chosen = RANGES.find(r => r.id === rangeId)!;
  const range = chosen.from <= time ? chosen : RANGES.find(r => r.from <= time) ?? RANGES[RANGES.length - 1];
  const deepChosen = DEEP_RANGES.find(r => r.id === deepRangeId)!;
  const deepRange = atMa(deepChosen.ma) <= time ? deepChosen : DEEP_RANGES.find(r => atMa(r.ma) <= time) ?? DEEP_RANGES[DEEP_RANGES.length - 1];
  const lo = deep ? atMa(deepRange.ma) : range.from;
  const speeds = deep ? DEEP_SPEEDS : SPEEDS;
  // Taking the deep clock in hand stops the documentary running it.
  const hold = () => { if (deep) session.story.hold(); };

  const go = (e: FormEvent) => {
    e.preventDefault();
    const ma = parseDeepJump(jump);
    const t = ma === undefined ? parseJump(jump) : undefined;
    setJumpError(ma === undefined && t === undefined);
    if (ma !== undefined) {
      session.setDeep(true);
      session.story.hold();
      session.deepClock.seek(atMa(ma));
    } else if (t !== undefined) {
      session.setDeep(false);
      session.clock.seek(t);
    }
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

  return (
    <div data-hud className="hidden md:flex absolute bottom-0 left-0 right-0 z-[270] h-9 items-center gap-3 px-3 bg-[#08080d]/95 border-t border-[var(--border-active)] backdrop-blur-xl font-mono text-[10.5px] text-[var(--text-secondary)]">
      <span className="text-[var(--gold-light)] tracking-[0.2em] text-[10px]">{deep ? 'DEEP TIME' : 'HISTORY'}</span>
      <button type="button" aria-label={clock.playing() ? 'Pause' : 'Play'} onClick={() => { hold(); if (clock.playing()) clock.pause(); else clock.play(); }}
        className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--hover-accent)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--gold-primary)]">
        {clock.playing() ? <Pause className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Play className="w-3.5 h-3.5" strokeWidth={1.5} />}
      </button>
      <select aria-label="History speed" value={clock.speed()} onChange={e => { hold(); clock.setSpeed(Number(e.target.value)); }} className={CONTROL}>
        {!speeds.some(s => s.x === clock.speed()) && <option value={clock.speed()}>Custom</option>}
        {speeds.map(s => <option key={s.x} value={s.x}>{s.label}</option>)}
      </select>
      <span className="tabular-nums text-[var(--text-primary)] whitespace-nowrap min-w-[96px]">{deep ? formatMa(maAt(time)) : formatTime(time, hi - range.from)}</span>
      <form onSubmit={go} className="flex items-center">
        <input aria-label="Jump to a date, a year or an age" value={jump} placeholder="Jump: 1939-09-01, 500 BCE, 250 Ma"
          onChange={e => { setJump(e.target.value); setJumpError(false); }}
          className={`h-6 w-48 px-2 rounded-md bg-black/40 border text-[10.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none ${
            jumpError ? 'border-[var(--alert-red)]/60' : 'border-white/10 focus:border-[var(--gold-primary)]/50'}`} />
      </form>
      <select aria-label="Timeline range" value={deep ? deepRange.id : range.id} onChange={e => pickRange(e.target.value)} className={CONTROL}>
        <optgroup label="Calendar">
          {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </optgroup>
        <optgroup label="Deep time: the plates">
          {DEEP_RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </optgroup>
      </select>
      <TimelineScrubber time={time} lo={lo} hi={hi} coverage={[]} provisionalFrom={hi} onSeek={t => { hold(); clock.seek(t); }} />
      <button type="button" onClick={onExit} title="Back to the live map"
        className="h-6 px-2 rounded-md border border-[var(--alert-red)]/40 text-[var(--alert-red)] hover:bg-[var(--alert-red)]/10 tracking-[0.15em] text-[10px] flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--alert-red)]" />LIVE
      </button>
      {deep && <DeepTimeCard session={session} />}
      {!deep && session.countries.state().status !== 'off' && <CountryLegend session={session} />}
      {!deep && session.layers().length > 0 && <WarLegend session={session} />}
    </div>
  );
}
