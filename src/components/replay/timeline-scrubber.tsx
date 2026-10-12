'use client';

import type { CoverageSpan } from '@/lib/replay/session';

/**
 * Where no source recorded anything, within the span the coverage describes. One quiet source while
 * another recorded is not a gap in the history, so only the complement of every recorded span is shaded.
 */
function gaps(coverage: CoverageSpan[], lo: number, hi: number) {
  if (!coverage.length) return [];
  const recorded = coverage
    .filter(c => c.status === 'ok' || c.status === 'degraded')
    .map(c => [c.from * 1000, c.to === null ? hi : c.to * 1000] as const)
    .sort((a, b) => a[0] - b[0]);
  const out: { from: number; to: number }[] = [];
  let cursor = Math.max(lo, Math.min(...coverage.map(c => c.from * 1000)));
  for (const [from, to] of recorded) {
    if (from > cursor) out.push({ from: cursor, to: Math.min(from, hi) });
    cursor = Math.max(cursor, to);
  }
  if (cursor < hi) out.push({ from: cursor, to: hi });
  return out.filter(g => g.to > g.from);
}

export default function TimelineScrubber({ time, lo, hi, coverage, provisionalFrom, onSeek }: {
  time: number;
  lo: number;
  hi: number;
  coverage: CoverageSpan[];
  /** From here to `hi` the history is still provisional. */
  provisionalFrom: number;
  onSeek: (t: number) => void;
}) {
  const span = Math.max(1, hi - lo);
  const pct = (t: number) => `${(100 * (Math.min(hi, Math.max(lo, t)) - lo)) / span}%`;
  return (
    <div className="relative flex-1 min-w-[120px] h-5 flex items-center">
      <div className="absolute inset-x-0 h-1 rounded-full bg-white/10 overflow-hidden">
        {gaps(coverage, lo, hi).map(g => (
          <div key={g.from} title="Not recorded"
            className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.18)_0_2px,transparent_2px_4px)]"
            style={{ left: pct(g.from), width: `calc(${pct(g.to)} - ${pct(g.from)})` }} />
        ))}
        <div className="absolute inset-y-0 bg-[var(--gold-primary)]/15" title="Provisional: sealed again once two hours old"
          style={{ left: pct(provisionalFrom), right: 0 }} />
        <div className="absolute inset-y-0 left-0 bg-[var(--gold-primary)]/60" style={{ width: pct(time) }} />
      </div>
      <input type="range" aria-label="Replay time" min={lo} max={hi} step={1000} value={Math.min(hi, Math.max(lo, time))}
        onChange={e => onSeek(Number(e.target.value))}
        className="relative w-full h-5 appearance-none bg-transparent cursor-pointer accent-[var(--gold-primary)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--gold-light)] [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--gold-light)]" />
    </div>
  );
}
