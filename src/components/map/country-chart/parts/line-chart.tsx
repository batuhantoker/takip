'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useT } from '@/components/ui/use-t';
import type { ChartedCountry } from '@/lib/history/countries/chart';
import { countryReading, formatYear, type SeriesPayload } from '@/lib/history/series';
import { SERIES_INK } from '@/lib/map/style/tokens';
import { useDrawIn } from '@/components/map/country-chart/hooks/use-draw-in';
import { extentOf, labelsThatFit, type Range, runsOf, timeTicks, valueAxis, visibleValues, zoomAround } from '@/components/map/country-chart/lib/chart-geometry';

const W = 368;
const PAD_L = 40;
const PAD_R = 8;
const PAD_T = 8;
/** Room under the plot for the year labels. */
const AXIS = 20;
/** Head labels flip to the dot's left this close to the right edge. */
const FLIP_AT = W - 96;
/** A press that moves less than this is a click (go there), more a drag (zoom to it). */
const DRAG_PX = 6;

type Head = { x: number; y: number; from: number };
type Line = ChartedCountry & {
  runs: { d: string; projected: boolean; from: number; to: number; dot: [number, number] | null }[];
};

/** One country: a faint line for its whole span, the same line solid up to the clock, and its value now. */
function CountryLine({ line, clipId, plotId, head }: { line: Line; clipId: string; plotId: string; head: Head | null }) {
  const ref = useRef<SVGGElement>(null);
  useDrawIn(ref);
  const color = SERIES_INK[line.slot];
  return (
    <g ref={ref} clipPath={`url(#${plotId})`}>
      {line.runs.map((r, i) => (r.dot ? (
        <circle key={i} cx={r.dot[0]} cy={r.dot[1]} r={2} fill={color} data-from={r.from} />
      ) : (
        <g key={i} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
          {r.projected ? (
            <>
              <path d={r.d} strokeOpacity={0.25} strokeWidth={1.5} strokeDasharray="4 3" data-from={r.from} data-to={r.to} />
              <path d={r.d} strokeWidth={2} strokeDasharray="4 3" clipPath={`url(#${clipId})`} data-from={r.from} data-to={r.to} />
            </>
          ) : (
            <>
              <path d={r.d} strokeOpacity={0.25} strokeWidth={1.5} pathLength={1} strokeDasharray="1 1" data-from={r.from} data-to={r.to} />
              <path d={r.d} strokeWidth={2} pathLength={1} strokeDasharray="1 1" clipPath={`url(#${clipId})`} data-from={r.from} data-to={r.to} />
            </>
          )}
        </g>
      )))}
      {head && <circle cx={head.x} cy={head.y} r={4} fill={color} stroke="var(--surface-1)" strokeWidth={2} data-from={head.from} />}
    </g>
  );
}

/**
 * The indicator over time for the charted countries. Lines are solid up to the History clock and faint after,
 * so playing History draws them; each line draws itself in when it arrives. The pointer reads a year and a click
 * takes the clock there; a drag zooms to the years it covers, a pinch (ctrl+wheel) zooms about the pointer,
 * a sideways scroll pans, and a double-click zooms back out.
 */
export function LineChart({ data, log, countries, at, hover, range, onHover, onSeek, onRange, height = 196 }: {
  data: SeriesPayload;
  /** The map's log scale, so the chart reads like its colours. */
  log: boolean;
  countries: ChartedCountry[];
  /** The clock, as a fractional year. */
  at: number;
  hover: number | null;
  /** The years in view, shared by every chart in the window; null shows all of this one's. */
  range: Range | null;
  onHover: (t: number | null) => void;
  onSeek: (t: number) => void;
  /** Asks for a view; the window keeps it inside the data, or lets go of it. */
  onRange: (r: Range | null) => void;
  /** In the chart's own units; it is drawn 368 wide and scales to the window. */
  height?: number;
}) {
  const t = useT();
  const tick = useMemo(() => new Intl.NumberFormat(t.intl, { notation: 'compact', maximumFractionDigits: 2 }), [t.intl]);
  const clipId = useId();
  const plotId = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ x0: number; from: number; to: number } | null>(null);
  const H = height;
  const PLOT_B = H - AXIS;
  const step = data.step ?? 'year';
  const geo = useMemo(() => {
    const series = countries.map(c => ({ ...c, points: data.values[c.key] ?? [] })).filter(s => s.points.length);
    const own = extentOf(series.map(s => s.points), step);
    if (!own) return null;
    const [t0, t1] = range ?? own;
    // Zoomed, the axis fits the years in view; with none of them in view it keeps them all.
    const axis = valueAxis(series.flatMap(s => visibleValues(s.points, step, [t0, t1])), log) ?? valueAxis(series.flatMap(s => s.points.map(p => p[1])), log);
    if (!axis) return null;
    const span = t1 - t0 || 1;
    const x = (t: number) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);
    const y = (v: number) => PAD_T + (1 - axis.norm(v)) * (PLOT_B - PAD_T);
    const lines: Line[] = series.map(s => ({
      ...s,
      // Each country's projections start where its own do, as countryReading reads them.
      runs: runsOf(s.points, step, data.projection?.starts[s.key]).map(r => {
        const [a, b] = [r.points[0], r.points[r.points.length - 1]];
        return {
          projected: r.projected,
          d: r.points.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(''),
          from: (a[0] - t0) / span,
          to: (b[0] - t0) / span,
          dot: r.points.length === 1 ? [x(a[0]), y(a[1])] as [number, number] : null,
        };
      }),
    }));
    return { t0, t1, span, x, y, axis, lines };
  }, [data, countries, log, step, PLOT_B, range]);

  /** The time under a screen x, unsnapped and unclamped. */
  const timeAt = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!geo || !box) return 0;
    return geo.t0 + ((((clientX - box.left) / box.width) * W - PAD_L) / (W - PAD_L - PAD_R)) * geo.span;
  };

  // React's wheel listener is passive; a pinch must not also zoom the page. A plain vertical scroll still scrolls the window.
  const wheel = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheel.current = e => {
      if (!geo) return;
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!e.ctrlKey && !(sideways && range)) return;
      e.preventDefault();
      if (e.ctrlKey) onRange(zoomAround([geo.t0, geo.t1], timeAt(e.clientX), Math.exp(Math.max(-0.4, Math.min(0.4, e.deltaY * 0.01)))));
      else {
        const dt = (e.deltaX / (svg.current?.getBoundingClientRect().width || 1)) * geo.span;
        onRange([geo.t0 + dt, geo.t1 + dt]);
      }
    };
  });
  const drawn = geo !== null;
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const listener = (e: WheelEvent) => wheel.current(e);
    el.addEventListener('wheel', listener, { passive: false });
    return () => el.removeEventListener('wheel', listener);
  }, [drawn]);

  if (!geo) return null;
  const { t0, t1, span, x, y, axis, lines } = geo;
  const inside = (t: number) => t >= t0 && t <= t1;
  const headX = x(Math.min(t1, Math.max(t0, at)));
  const heads = lines.flatMap(l => {
    const r = inside(at) ? countryReading(data, l.key, at) : null;
    return r ? [{ key: l.key, name: l.name, x: headX, y: y(r.v), from: (at - t0) / span }] : [];
  });
  const flip = headX > FLIP_AT;

  // A yearly chart reads whole years, at the mid-year its values count from.
  const snap = (t: number) => {
    const snapped = step === 'day' ? t : Math.floor(t) + 0.5;
    return Math.min(t1 - (step === 'day' ? 0 : 0.5), Math.max(t0 + (step === 'day' ? 0 : 0.5), snapped));
  };

  const names = countries.map(c => c.name).join(', ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full cursor-crosshair touch-none select-none" role="img"
      aria-label={t('{metric} for {names}, {from} to {to}', { metric: data.metric.name, names, from: formatYear(Math.floor(t0), t), to: formatYear(Math.floor(t1 - 0.5), t) })}
      ref={svg}
      onPointerDown={e => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ x0: e.clientX, from: timeAt(e.clientX), to: timeAt(e.clientX) });
      }}
      onPointerMove={e => {
        onHover(snap(timeAt(e.clientX)));
        if (drag) setDrag({ ...drag, to: timeAt(e.clientX) });
      }}
      onPointerUp={e => {
        if (!drag) return;
        setDrag(null);
        if (Math.abs(e.clientX - drag.x0) >= DRAG_PX) onRange([drag.from, timeAt(e.clientX)]);
        else onSeek(snap(timeAt(e.clientX)));
      }}
      onPointerCancel={() => setDrag(null)}
      onPointerLeave={() => onHover(null)}
      onDoubleClick={() => onRange(null)}>
      <defs>
        <clipPath id={clipId}><rect x={PAD_L} y={0} width={Math.max(0, inside(at) || at > t1 ? headX - PAD_L : 0)} height={H} /></clipPath>
        {/* Zoomed in, lines run past the axes; the margin keeps a head dot at the edge whole. */}
        <clipPath id={plotId}><rect x={PAD_L - 5} y={PAD_T - 5} width={W - PAD_L - PAD_R + 10} height={PLOT_B - PAD_T + 10} /></clipPath>
      </defs>
      {axis.ticks.map(t => (
        <g key={t}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fill="var(--ink-3)" fontSize={11} className="font-mono tabular-nums">{tick.format(t)}</text>
        </g>
      ))}
      {timeTicks(t0, t1).map(tick => {
        const tx = x(tick);
        const anchor = tx < PAD_L + 16 ? 'start' : tx > W - 20 ? 'end' : 'middle';
        return <text key={tick} x={tx} y={H - 5} textAnchor={anchor} fill="var(--ink-3)" fontSize={11} className="font-mono tabular-nums">{formatYear(tick, t)}</text>;
      })}
      {inside(at) && <line x1={headX} x2={headX} y1={PAD_T} y2={PLOT_B} stroke="var(--accent)" strokeOpacity={0.5} />}
      {lines.map(l => (
        // Keyed by the metric too, so another indicator draws in afresh.
        <CountryLine key={`${data.metric.code}:${l.key}`} line={l} clipId={clipId} plotId={plotId} head={heads.find(h => h.key === l.key) ?? null} />
      ))}
      {labelsThatFit(heads, 13).map(h => (
        <text key={h.key} x={flip ? h.x - 8 : h.x + 8} y={h.y + 4} textAnchor={flip ? 'end' : 'start'} fontSize={11}
          fill="var(--ink-2)" stroke="var(--surface-1)" strokeWidth={3} paintOrder="stroke">{h.name}</text>
      ))}
      {drag && Math.abs(x(drag.to) - x(drag.from)) > 0 && (
        <rect x={Math.max(PAD_L, Math.min(x(drag.from), x(drag.to)))} y={PAD_T} height={PLOT_B - PAD_T} pointerEvents="none"
          width={Math.min(W - PAD_R, Math.max(x(drag.from), x(drag.to))) - Math.max(PAD_L, Math.min(x(drag.from), x(drag.to)))}
          fill="var(--ink-1)" fillOpacity={0.08} />
      )}
      {hover !== null && inside(hover) && (
        <g pointerEvents="none">
          <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PLOT_B} stroke="var(--ink-3)" />
          {lines.map(l => {
            const r = countryReading(data, l.key, hover);
            return r && <circle key={l.key} cx={x(hover)} cy={y(r.v)} r={4} fill="var(--surface-1)" stroke={SERIES_INK[l.slot]} strokeWidth={2} />;
          })}
        </g>
      )}
    </svg>
  );
}
