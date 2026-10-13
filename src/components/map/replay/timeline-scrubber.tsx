'use client';

import { type KeyboardEvent, type PointerEvent, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui/class-names';
import type { CoverageSpan } from '@/lib/replay/session';
import type { Tick } from '@/lib/replay/timeline-ticks';

/**
 * Where no source recorded anything, within the span the coverage describes. One quiet source while
 * another recorded is not a gap in the history, so only the complement of every recorded span is shaded.
 */
export function coverageGaps(coverage: CoverageSpan[], lo: number, hi: number) {
  if (!coverage.length) return [];
  const recorded = coverage
    .filter(c => c.status === 'ok' || c.status === 'degraded')
    .map(c => [c.from * 1000, c.to === null ? hi : c.to * 1000] as const)
    .sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  let cursor = Math.max(lo, Math.min(...coverage.map(c => c.from * 1000)));
  for (const [from, to] of recorded) {
    if (from > cursor) out.push({ from: cursor, to: Math.min(from, hi) });
    cursor = Math.max(cursor, to);
  }
  if (cursor < hi) out.push({ from: cursor, to: hi });
  return out.filter(g => g.to > g.from);
}

type Span = { from: number; to: number };
/** A coloured stretch under the rail, such as a geological period. */
export type Band = Span & { color: string };

/** Room a tick label needs: its characters in 11 px mono (0.6 em each), and a gap. */
const labelRoom = (ticks: Tick[]) => Math.max(0, ...ticks.map(t => t.label.length)) * 6.6 + 18;

/** As many ticks as fit without their labels touching. */
function fitTicks(ticksFor: (max: number) => Tick[], width: number) {
  for (let max = Math.floor(width / 48); max > 2; max = Math.floor(max * 0.8)) {
    const ticks = ticksFor(max);
    if (width / Math.max(1, ticks.length) >= labelRoom(ticks)) return ticks;
  }
  return ticksFor(2);
}
const STEP_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };

export type TimelineScrubberProps = {
  /** Names the slider for screen readers. */
  label: string;
  lo: number;
  hi: number;
  time: number;
  /** How far an arrow key moves; Shift moves ten times as far. */
  step: number;
  onSeek: (t: number) => void;
  /** Space on the focused track. */
  onTogglePlay?: () => void;
  /** The time under the pointer and the slider's spoken value. */
  format: (t: number) => string;
  ticksFor: (max: number) => Tick[];
  gaps?: Span[];
  /** From here to `hi` the record is still provisional. */
  provisionalFrom?: number;
  /** What the hover readout adds over a gap or the provisional stretch. */
  notes?: { gap?: string; provisional?: string };
  bands?: Band[];
};

/** The track both timelines share: ticks, the played stretch, a handle to drag, the time under the pointer, and arrow keys. */
export default function TimelineScrubber({
  label, lo, hi, time, step, onSeek, onTogglePlay, format, ticksFor, gaps = [], provisionalFrom, notes, bands,
}: TimelineScrubberProps) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const span = Math.max(1, hi - lo);
  const clamp = (t: number) => Math.min(hi, Math.max(lo, t));
  const frac = (t: number) => (clamp(t) - lo) / span;
  const pct = (t: number) => `${frac(t) * 100}%`;
  const timeAt = (clientX: number) => {
    const box = root.current!.getBoundingClientRect();
    return lo + Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * span;
  };
  const shown = drag ?? clamp(time);
  const ticks = width ? fitTicks(ticksFor, width) : [];

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    const t = timeAt(e.clientX);
    setDrag(t);
    onSeek(t);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const t = timeAt(e.clientX);
    if (e.pointerType !== 'touch') setHover(t);
    if (drag === null) return;
    setDrag(t);
    onSeek(t);
  };
  const endDrag = () => setDrag(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' && onTogglePlay) {
      e.preventDefault();
      onTogglePlay();
      return;
    }
    let next: number | undefined;
    if (e.key === 'Home') next = lo;
    else if (e.key === 'End') next = hi;
    else if (STEP_KEYS[e.key]) next = clamp(time + STEP_KEYS[e.key] * step * (e.shiftKey ? 10 : 1));
    if (next === undefined) return;
    e.preventDefault();
    onSeek(next);
  };

  const readoutAt = drag ?? hover;
  const inGap = readoutAt !== null && gaps.some(g => readoutAt >= g.from && readoutAt < g.to);
  const provisional = readoutAt !== null && provisionalFrom !== undefined && readoutAt >= provisionalFrom;
  const note = inGap ? notes?.gap : provisional ? notes?.provisional : undefined;
  /** Centred on its point, unless half of it (`half` px) would hang off an end of the track. */
  const edge = (f: number, half: number) => {
    const x = f * width;
    return x < half ? 'translate-x-0' : x > width - half ? '-translate-x-full' : '-translate-x-1/2';
  };

  return (
    <div
      ref={root}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={lo}
      aria-valuemax={hi}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={format(shown)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onLostPointerCapture={endDrag}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      className="group relative h-11 min-w-[120px] flex-1 cursor-pointer touch-none outline-none select-none"
    >
      <div className="absolute inset-x-0 top-[13px] h-1 overflow-hidden rounded-full bg-surface-3">
        {gaps.map(g => (
          <div key={g.from} className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--ink-4)_0_1.5px,transparent_1.5px_4px)]"
            style={{ left: pct(g.from), width: `${(frac(g.to) - frac(g.from)) * 100}%` }} />
        ))}
        <div className="absolute inset-y-0 left-0 bg-accent/40" style={{ width: pct(shown) }} />
        {/* Dashed, over the played stretch too: not yet final. */}
        {provisionalFrom !== undefined && provisionalFrom < hi && (
          <div className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(90deg,transparent_0_4px,var(--surface-1)_4px_6px)]"
            style={{ left: pct(provisionalFrom) }} />
        )}
      </div>

      {bands?.map(b => (
        <div key={b.from} className="absolute top-5 h-[3px] border-r border-surface-1 opacity-70"
          style={{ left: pct(b.from), width: `${(frac(b.to) - frac(b.from)) * 100}%`, background: b.color }} />
      ))}

      {ticks.map(t => {
        const f = frac(t.at);
        return (
          <div key={t.at} aria-hidden className="pointer-events-none absolute top-0 left-0 h-full" style={{ left: `${f * 100}%` }}>
            {!bands && <span className="absolute top-[21px] h-1 w-px bg-line-strong" />}
            <span className={cx('absolute top-[29px] font-mono text-meta whitespace-nowrap text-ink-3 tabular-nums', edge(f, t.label.length * 3.3))}>{t.label}</span>
          </div>
        );
      })}

      {readoutAt !== null && (
        <div aria-hidden className="pointer-events-none absolute top-0 h-full" style={{ left: pct(readoutAt) }}>
          {drag === null && <span className="absolute top-[9px] h-3 w-px -translate-x-1/2 bg-ink-3" />}
          <span className={cx(
            'absolute bottom-[calc(100%-4px)] flex items-center gap-1.5 rounded-control border border-line-strong bg-surface-3 px-2 py-1 whitespace-nowrap shadow-float',
            edge(frac(readoutAt), 64),
          )}>
            <span className="font-mono text-small font-medium text-ink-1 tabular-nums">{format(readoutAt)}</span>
            {note && <span className="text-small text-ink-3">{note}</span>}
          </span>
        </div>
      )}

      <span aria-hidden
        className={cx(
          'pointer-events-none absolute top-[15px] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-1 shadow-float ring-2 ring-surface-1',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent',
          drag !== null && 'scale-110',
        )}
        style={{ left: pct(shown) }} />
    </div>
  );
}
