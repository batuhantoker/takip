'use client';

import { type FormEvent, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { SEAL_DELAY_MS } from '@takip/core/tracks';
import type { ReplaySession } from '@/lib/replay/session';
import { formatTime, HISTORY_START, parseJump } from '@/lib/replay/time-input';
import TimelineScrubber from './timeline-scrubber';
import { useReplayTick } from './use-replay';

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
const SPEEDS = [
  { x: 1, label: '1×' },
  { x: 60, label: '1 min/s' },
  { x: 3600, label: '1 h/s' },
  { x: 86_400, label: '1 day/s' },
  { x: 30 * 86_400, label: '1 mo/s' },
  { x: 365 * 86_400, label: '1 yr/s' },
];
/** How much history the scrubber spans, ending now. */
const RANGES = [
  { id: 'day', label: '24 h', ms: DAY_MS },
  { id: 'month', label: '30 d', ms: 30 * DAY_MS },
  { id: 'year', label: '1 yr', ms: YEAR_MS },
  { id: 'century', label: '100 yr', ms: 100 * YEAR_MS },
  { id: 'all', label: 'All', ms: Number.POSITIVE_INFINITY },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

const STATE_TEXT = {
  loading: 'Loading…',
  zoom_in: 'Zoom in to see tracks here',
  nothing_recorded: 'Nothing recorded at this time',
  before_window: 'No ships or aircraft recorded this far back',
  nothing_selected: 'Ships and flights are off in Layers',
};

/** The smallest range that still shows `t`. */
const rangeFor = (t: number, now: number): RangeId => RANGES.find(r => now - t <= r.ms)?.id ?? 'all';

/** Replaces the status bar while replay is on: play, speed, the time, a jump box, a scrubber and the way back to live. */
export default function TimelineBar({ session, onExit }: { session: ReplaySession; onExit: () => void }) {
  const now = useReplayTick(session);
  const [rangeId, setRangeId] = useState<RangeId>('day');
  const [jump, setJump] = useState('');
  const [jumpError, setJumpError] = useState(false);
  const { clock } = session;
  const manifest = session.manifest();
  const stats = session.stats();
  const time = clock.time();
  const hi = now || time;
  const range = RANGES.find(r => r.id === rangeId)!;
  const lo = Number.isFinite(range.ms) ? hi - range.ms : HISTORY_START;
  const error = session.error();

  const go = (e: FormEvent) => {
    e.preventDefault();
    const t = parseJump(jump);
    setJumpError(t === undefined);
    if (t === undefined) return;
    clock.seek(t);
    setRangeId(rangeFor(t, hi));
  };

  return (
    <div data-hud className="hidden md:flex absolute bottom-0 left-0 right-0 z-[270] h-9 items-center gap-3 px-3 bg-[#08080d]/95 border-t border-[var(--border-active)] backdrop-blur-xl font-mono text-[10.5px] text-[var(--text-secondary)]">
      <span className="text-[var(--gold-light)] tracking-[0.2em] text-[10px]">REPLAY</span>
      <button type="button" aria-label={clock.playing() ? 'Pause' : 'Play'} onClick={() => (clock.playing() ? clock.pause() : clock.play())}
        className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--hover-accent)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--gold-primary)]">
        {clock.playing() ? <Pause className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Play className="w-3.5 h-3.5" strokeWidth={1.5} />}
      </button>
      <select aria-label="Replay speed" value={clock.speed()} onChange={e => clock.setSpeed(Number(e.target.value))}
        className="h-6 px-1.5 rounded-md bg-black/40 border border-white/10 text-[10.5px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold-primary)]/50">
        {SPEEDS.map(s => <option key={s.x} value={s.x}>{s.label}</option>)}
      </select>
      <span className="tabular-nums text-[var(--text-primary)] whitespace-nowrap min-w-[150px]">{formatTime(time, hi - lo)}</span>
      <form onSubmit={go} className="flex items-center">
        <input aria-label="Jump to a date or year" value={jump} placeholder="Jump: 1916, 2003-03-20, 500 BCE"
          onChange={e => { setJump(e.target.value); setJumpError(false); }}
          className={`h-6 w-48 px-2 rounded-md bg-black/40 border text-[10.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none ${
            jumpError ? 'border-[var(--alert-red)]/60' : 'border-white/10 focus:border-[var(--gold-primary)]/50'}`} />
      </form>
      <select aria-label="Timeline range" value={rangeId} onChange={e => setRangeId(e.target.value as RangeId)}
        className="h-6 px-1.5 rounded-md bg-black/40 border border-white/10 text-[10.5px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold-primary)]/50">
        {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <TimelineScrubber time={time} lo={lo} hi={hi} coverage={manifest?.coverage ?? []} provisionalFrom={hi - SEAL_DELAY_MS}
        onSeek={t => clock.seek(t)} />
      <span className="whitespace-nowrap text-[var(--text-muted)] min-w-[150px] text-right" role="status">
        {error ? `Replay unavailable: ${error}` : stats.state === 'ok' ? `${stats.shown.toLocaleString('en')} tracks in view` : STATE_TEXT[stats.state]}
      </span>
      <button type="button" onClick={onExit} title="Back to the live map"
        className="h-6 px-2 rounded-md border border-[var(--alert-red)]/40 text-[var(--alert-red)] hover:bg-[var(--alert-red)]/10 tracking-[0.15em] text-[10px] flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--alert-red)]" />LIVE
      </button>
    </div>
  );
}
