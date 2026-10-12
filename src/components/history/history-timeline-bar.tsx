'use client';

import { type FormEvent, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { HistorySession } from '@/lib/history/session';
import { formatTime, HISTORY_START, parseJump } from '@/lib/replay/time-input';
import TimelineScrubber from '@/components/replay/timeline-scrubber';
import CountryLegend from './country-legend';
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

const CONTROL = 'h-6 px-1.5 rounded-md bg-black/40 border border-white/10 text-[10.5px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold-primary)]/50';

/** Replaces the status bar while History is on: play, speed, the date, a jump box, a scrubber and the way back to live. */
export default function HistoryTimelineBar({ session, onExit }: { session: HistorySession; onExit: () => void }) {
  useHistoryTick(session);
  const [rangeId, setRangeId] = useState<RangeId>('1900');
  const [jump, setJump] = useState('');
  const [jumpError, setJumpError] = useState(false);
  const { clock } = session;
  const time = clock.time();
  const hi = Date.now();
  // A time before the chosen range shows the smallest range that reaches it, without forgetting the choice.
  const chosen = RANGES.find(r => r.id === rangeId)!;
  const range = chosen.from <= time ? chosen : RANGES.find(r => r.from <= time) ?? RANGES[RANGES.length - 1];

  const go = (e: FormEvent) => {
    e.preventDefault();
    const t = parseJump(jump);
    setJumpError(t === undefined);
    if (t !== undefined) clock.seek(t);
  };

  return (
    <div data-hud className="hidden md:flex absolute bottom-0 left-0 right-0 z-[270] h-9 items-center gap-3 px-3 bg-[#08080d]/95 border-t border-[var(--border-active)] backdrop-blur-xl font-mono text-[10.5px] text-[var(--text-secondary)]">
      <span className="text-[var(--gold-light)] tracking-[0.2em] text-[10px]">HISTORY</span>
      <button type="button" aria-label={clock.playing() ? 'Pause' : 'Play'} onClick={() => (clock.playing() ? clock.pause() : clock.play())}
        className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--hover-accent)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--gold-primary)]">
        {clock.playing() ? <Pause className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Play className="w-3.5 h-3.5" strokeWidth={1.5} />}
      </button>
      <select aria-label="History speed" value={clock.speed()} onChange={e => clock.setSpeed(Number(e.target.value))} className={CONTROL}>
        {!SPEEDS.some(s => s.x === clock.speed()) && <option value={clock.speed()}>Custom</option>}
        {SPEEDS.map(s => <option key={s.x} value={s.x}>{s.label}</option>)}
      </select>
      <span className="tabular-nums text-[var(--text-primary)] whitespace-nowrap min-w-[96px]">{formatTime(time, hi - range.from)}</span>
      <form onSubmit={go} className="flex items-center">
        <input aria-label="Jump to a date or year" value={jump} placeholder="Jump: 1939-09-01, 1066, 500 BCE"
          onChange={e => { setJump(e.target.value); setJumpError(false); }}
          className={`h-6 w-48 px-2 rounded-md bg-black/40 border text-[10.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none ${
            jumpError ? 'border-[var(--alert-red)]/60' : 'border-white/10 focus:border-[var(--gold-primary)]/50'}`} />
      </form>
      <select aria-label="Timeline range" value={range.id} onChange={e => setRangeId(e.target.value as RangeId)} className={CONTROL}>
        {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <TimelineScrubber time={time} lo={range.from} hi={hi} coverage={[]} provisionalFrom={hi} onSeek={t => clock.seek(t)} />
      <button type="button" onClick={onExit} title="Back to the live map"
        className="h-6 px-2 rounded-md border border-[var(--alert-red)]/40 text-[var(--alert-red)] hover:bg-[var(--alert-red)]/10 tracking-[0.15em] text-[10px] flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--alert-red)]" />LIVE
      </button>
      {session.countries.state().status !== 'off' && <CountryLegend session={session} />}
      {session.layers().length > 0 && <WarLegend session={session} />}
    </div>
  );
}
