import { cx } from '@/components/ui/class-names';
import type { Yearly } from '@/lib/platform/site/places/topics/indicators-data';
import { bandPath, BOX, domainOf, linePath, niceTicks, pct, points, scales, yearTicks } from '../lib/chart-geometry';
import { ChartHover, type HoverRow } from './chart-hover';

/**
 * One measure over the years for one or more places, drawn on the server: each place's estimates solid, an older
 * source before them fainter, a model's run thin, and the projection dashed over its published range. A comparison
 * line (the World) is a hairline in muted ink. One axis, one unit. The SVG stretches to its frame with strokes kept
 * at their width; the text sits over it in HTML so it stays readable on a phone.
 */

export interface ChartLine {
  key: string;
  /** The place or series, in the tooltip and table. */
  label: string;
  ink: string;
  /** A comparison: hairline, muted, no labels of its own. */
  faint?: boolean;
  /** Estimates or measurements; `l` an older source before them; `m` a model's run. */
  e?: Yearly;
  l?: Yearly;
  m?: Yearly;
  /** The projection and its range. */
  p?: Yearly;
  lo?: Yearly;
  hi?: Yearly;
  /** Years of `e` the source gives as its estimate, and as highly uncertain: marked, never hidden. */
  est?: number[];
  unc?: number[];
}

export interface ChartWords { projected: string; modelled: string; estimate: string; uncertain: string; label: string }

export type LegendMark = 'line' | 'faded' | 'thin' | 'dashed' | 'band' | 'faint' | 'dot' | 'ring';
export interface LegendItem { label: string; ink: string; mark: LegendMark }

export function LegendKey({ ink, mark }: { ink: string; mark: LegendMark }) {
  if (mark === 'dot') return <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: ink }} />;
  if (mark === 'ring') return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full border-2" style={{ borderColor: ink }} />;
  if (mark === 'band') return <span aria-hidden className="inline-block h-2.5 w-4 shrink-0 rounded-[2px]" style={{ background: ink, opacity: 0.18 }} />;
  return (
    <svg aria-hidden width="16" height="4" className="shrink-0">
      <line x1="1" x2="15" y1="2" y2="2" stroke={ink} strokeLinecap="round"
        strokeWidth={mark === 'faint' || mark === 'thin' ? 1.25 : 2} strokeDasharray={mark === 'dashed' ? '3 3' : undefined} opacity={mark === 'faded' ? 0.55 : 1} />
    </svg>
  );
}

/** A zero-length segment at each listed year's point, which the round cap draws as a dot. */
function dots(e: Yearly, years: number[], s: ReturnType<typeof scales>): string {
  const at = new Map(points(e));
  return years.flatMap(y => (at.has(y) ? [`M${s.x(y).toFixed(1)} ${s.y(at.get(y)!).toFixed(1)}l0 0`] : [])).join('');
}

const STROKE = { vectorEffect: 'non-scaling-stroke' as const, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Lines({ line, s }: { line: ChartLine; s: ReturnType<typeof scales> }) {
  const w = line.faint ? 1.25 : 2;
  const path = (y?: Yearly) => (y ? linePath(points(y), s) : '');
  return (
    <g>
      {line.lo && line.hi && <path d={bandPath(line.lo, line.hi, s)} fill={line.ink} opacity={line.faint ? 0.06 : 0.14} />}
      {line.m && <path d={path(line.m)} stroke={line.ink} strokeWidth={1.25} opacity={0.7} {...STROKE} />}
      {line.l && <path d={path(line.l)} stroke={line.ink} strokeWidth={w} opacity={0.55} {...STROKE} />}
      {line.e && <path d={path(line.e)} stroke={line.ink} strokeWidth={w} {...STROKE} />}
      {line.p && <path d={path(line.p)} stroke={line.ink} strokeWidth={w} strokeDasharray="4 4" {...STROKE} />}
      {line.e && line.est && <path d={dots(line.e, line.est, s)} stroke={line.ink} strokeWidth={5} {...STROKE} />}
      {line.e && line.unc && (
        <>
          <path d={dots(line.e, line.unc, s)} stroke={line.ink} strokeWidth={9} {...STROKE} />
          <path d={dots(line.e, line.unc, s)} stroke="var(--surface-1)" strokeWidth={4} {...STROKE} />
        </>
      )}
    </g>
  );
}

const last = (y?: Yearly) => {
  const pts = y ? points(y) : [];
  return pts[pts.length - 1];
};

/** Every year any line has a value, with each line's value that year: estimate, older run, model or projection. */
function hoverRows(lines: ChartLine[], value: (v: number) => string, words: ChartWords): HoverRow[] {
  const { projected, modelled } = words;
  const years = new Set<number>();
  const maps = lines.map(line => {
    const of = (y: Yearly | undefined) => new Map(y ? points(y) : []);
    const m = { e: of(line.e), l: of(line.l), m: of(line.m), p: of(line.p), lo: of(line.lo), hi: of(line.hi) };
    for (const map of [m.e, m.l, m.m, m.p]) for (const y of map.keys()) years.add(y);
    return m;
  });
  const marked = lines.map(l => ({ est: new Set(l.est), unc: new Set(l.unc) }));
  return [...years].sort((a, b) => a - b).map(year => ({
    year,
    cells: maps.map((m, i) => {
      const e = m.e.get(year) ?? m.l.get(year);
      const mark = marked[i].unc.has(year) ? words.uncertain : marked[i].est.has(year) ? words.estimate : undefined;
      if (e !== undefined) return mark ? `${value(e)} · ${mark}` : value(e);
      const p = m.p.get(year);
      if (p !== undefined) return `${value(p)} · ${projected}`;
      const mv = m.m.get(year);
      return mv !== undefined ? `${value(mv)} · ${modelled}` : '';
    }),
  }));
}

export function IndicatorChart({ id, lines, legend, title, desc, tick, value, words, size = 'hero' }: {
  id: string;
  lines: ChartLine[];
  legend: LegendItem[];
  title: string;
  desc: string;
  /** An axis tick, short: "80", "85M", "$15K". */
  tick: (v: number) => string;
  /** A value in full, for the end labels and the tooltip. */
  value: (v: number) => string;
  /** "Projected" at the projection's start, and what the tooltip calls a projected, modelled, estimated or uncertain value. */
  words: ChartWords;
  size?: 'hero' | 'body';
}) {
  const domain = domainOf(lines.flatMap(l => [l.e, l.l, l.m, l.p, l.lo, l.hi]));
  if (!domain) return null;
  const yTicks = niceTicks(domain.y[0], domain.y[1]);
  const full = { ...domain, y: [yTicks[0], yTicks[yTicks.length - 1]] as [number, number] };
  const sc = scales(full);
  const xTicks = yearTicks(full.x[0], full.x[1]);
  const lead = lines.find(l => !l.faint);
  const end = last(lead?.e);
  const projEnd = last(lead?.p);
  const projStart = lead?.p ? points(lead.p)[0] : undefined;
  const at = (p: [number, number]) => ({ left: pct(sc.x(p[0])), top: pct(sc.y(p[1])) });
  const rightAligned = (p: [number, number]) => sc.x(p[0]) > BOX * 0.8;

  return (
    <figure className="w-full">
      <div className={cx('relative w-full', size === 'hero' ? 'h-[240px] sm:h-[300px]' : 'h-[200px] sm:h-[240px]')}>
        <div className="absolute inset-y-0 left-0 w-14" aria-hidden>
          {yTicks.map(v => (
            <span key={v} className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-ink-3 tabular-nums"
              style={{ top: `calc(8px + (100% - 32px) * ${(sc.y(v) / BOX).toFixed(4)})` }}>{tick(v)}</span>
          ))}
        </div>
        <div className="absolute top-2 right-3 bottom-6 left-14">
          <svg viewBox={`0 0 ${BOX} ${BOX}`} preserveAspectRatio="none" role="img" aria-labelledby={`${id}-t ${id}-d`} className="absolute inset-0 size-full overflow-visible">
            <title id={`${id}-t`}>{title}</title>
            <desc id={`${id}-d`}>{desc}</desc>
            {yTicks.map(v => <line key={v} x1={0} x2={BOX} y1={sc.y(v)} y2={sc.y(v)} stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
            {projStart && <line x1={sc.x(projStart[0])} x2={sc.x(projStart[0])} y1={0} y2={BOX} stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
            {[...lines].sort((a, b) => Number(!a.faint) - Number(!b.faint)).map(line => <Lines key={line.key} line={line} s={sc} />)}
          </svg>
          {projStart && (
            <span className="absolute top-0 ml-1.5 text-[11px] text-ink-3" style={{ left: pct(sc.x(projStart[0])) }} aria-hidden>{words.projected} →</span>
          )}
          {lead && end && (
            <>
              <span aria-hidden className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-1" style={{ ...at(end), background: lead.ink }} />
              <span aria-hidden className={cx('absolute -translate-y-[130%] text-[12px] font-medium whitespace-nowrap text-ink-1', rightAligned(end) ? '-translate-x-full' : '-translate-x-1/2')} style={at(end)}>
                {value(end[1])}
              </span>
            </>
          )}
          {lead && projEnd && (
            <span aria-hidden className="absolute -translate-x-full -translate-y-[130%] text-[12px] whitespace-nowrap text-ink-2" style={at(projEnd)}>{value(projEnd[1])}</span>
          )}
          <div className="absolute inset-x-0 top-full h-6" aria-hidden>
            {xTicks.map(y => (
              <span key={y} className="absolute top-1.5 -translate-x-1/2 font-mono text-[11px] text-ink-3 tabular-nums" style={{ left: pct(sc.x(y)) }}>{y}</span>
            ))}
          </div>
          <ChartHover from={full.x[0]} to={full.x[1]} rows={hoverRows(lines, value, words)}
            keys={lines.map(l => ({ label: l.label, ink: l.ink }))} label={words.label} />
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {legend.map(item => (
          <span key={item.label} className="flex items-center gap-1.5 text-[12px] text-ink-2"><LegendKey ink={item.ink} mark={item.mark} />{item.label}</span>
        ))}
      </figcaption>
    </figure>
  );
}

/** A measure's shape at a glance: estimates solid, projection dashed, no axes. */
export function Sparkline({ e, p, ink, className }: { e: Yearly; p?: Yearly; ink: string; className?: string }) {
  const domain = domainOf([e, p]);
  if (!domain) return null;
  const s = scales(domain);
  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} preserveAspectRatio="none" aria-hidden className={cx('overflow-visible', className)}>
      <path d={linePath(points(e), s)} stroke={ink} strokeWidth={1.5} {...STROKE} />
      {p && <path d={linePath(points(p), s)} stroke={ink} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.8} {...STROKE} />}
    </svg>
  );
}
