'use client';
/**
 * TAKIP TI: the timeline view.
 *
 * The simulation over dated time: above, the worlds pooled period by period
 * with their range, the base rate (or today's value), events added by the
 * reader and the report's final word; below, one lane per simulated world
 * with where the question stood in it after each period, how far it moved,
 * and what happened. A lane opens its world; an event opens itself.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, GanttChart, LoaderCircle } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { EmptyState } from '@/components/ui/empty-state';
import { Dot } from '@/components/ui/tag';
import { formatAmount } from '@/lib/ai/forecast';
import { priceText } from '@/lib/ai/quant/series';
import { timelineOf, type Timeline, type TimelineCell, type TimelineLane } from '@/lib/ai/workspace/timeline';
import { castOf, type RunState } from '@/lib/ai/state';
import { fit, fmtDate, plural, smooth } from '@/components/panels/ti-agent/theme';
import { TypeIcon } from '@/components/panels/ti-agent/atoms';
import { Figures } from '@/components/panels/ti-agent/parts/figures';

const NAME_COL = 196;
const MIN_COL = 150;
const TICK = { fontSize: 11 };
const HALO = { fontSize: 11, strokeWidth: 3, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const };

/** A change, in the question's own terms: points of probability or share, or the amount itself. */
function deltaText(s: RunState, cell: TimelineCell, prev: TimelineCell | null): string {
  if (s.frame?.kind === 'number') {
    const a = prev?.point.value, b = cell.point.value;
    if (a === undefined || b === undefined) return '';
    const d = b - a;
    return `${d > 0 ? '+' : d < 0 ? '−' : ''}${formatAmount(Math.abs(d))}`;
  }
  const pts = Math.round((cell.delta ?? 0) * 100);
  return `${pts > 0 ? '+' : pts < 0 ? '−' : ''}${Math.abs(pts)}`;
}

function Delta({ s, cell, prev }: { s: RunState; cell: TimelineCell; prev: TimelineCell | null }) {
  if (cell.delta === null || Math.abs(cell.delta) < 0.005) return null;
  const Icon = cell.delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 font-mono text-meta text-ink-3 tabular-nums">
      <Icon aria-hidden className="size-3" strokeWidth={2} />{deltaText(s, cell, prev)}
    </span>
  );
}

/** How far a world moved from its first period to its last. */
function Drift({ s, lane }: { s: RunState; lane: TimelineLane }) {
  const spoken = lane.cells.filter((c): c is TimelineCell => c !== null);
  if (lane.drift === null || spoken.length < 2) return <span className="px-2.5 py-2 text-small text-ink-4">—</span>;
  const held = Math.abs(lane.drift) < 0.005;
  const first = spoken[0], last = spoken[spoken.length - 1];
  const text = s.frame?.kind === 'number' ? deltaText(s, last, first) : `${lane.drift > 0 ? '+' : '−'}${Math.round(Math.abs(lane.drift) * 100)} pts`;
  return <span className={cx('px-2.5 py-2 text-small', held ? 'text-ink-3' : 'font-mono text-ink-1 tabular-nums')}>{held ? 'Held' : text}</span>;
}

/**
 * The part of the scale the simulation actually used, at least a fifth of it,
 * so worlds moving between 44% and 46% read as moving. Chart and lanes share it.
 */
function windowOf(tl: Timeline): [number, number] {
  const vals: number[] = [];
  const add = (...xs: (number | null | undefined)[]) => { for (const x of xs) if (typeof x === 'number' && Number.isFinite(x)) vals.push(x); };
  for (const l of tl.lanes) for (const c of l.cells) add(c?.value);
  for (const p of tl.pooled) add(p?.value, p?.low, p?.high);
  add(tl.final?.value, tl.final?.low, tl.final?.high, tl.reference?.value);
  if (!vals.length) return [0, 1];
  const [a, b] = fit(vals, 0.2);
  let lo = Math.max(0, a), hi = Math.min(1, b);
  if (hi - lo < 0.2) { if (lo === 0) hi = Math.min(1, 0.2); else lo = Math.max(0, hi - 0.2); }
  return [lo, hi];
}

/** The worlds pooled across the periods, drawn in the columns the lanes use. */
function PooledChart({ tl, cols, win }: { tl: Timeline; cols: number; win: [number, number] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 132, pad = 18;
  const x = (i: number) => ((i + 0.5) / cols) * w;
  const norm = (v: number) => Math.min(1, Math.max(0, (v - win[0]) / (win[1] - win[0] || 1)));
  const y = (v: number) => pad + (1 - norm(v)) * (H - pad * 2);
  const grid = [win[0], (win[0] + win[1]) / 2, win[1]];
  const pts = tl.pooled.map((p, i) => (p ? { ...p, i } : null)).filter((p): p is NonNullable<typeof p> => p !== null);
  const band = pts.filter(p => p.low !== null && p.high !== null);
  const finalX = tl.final ? x(cols - 1) : 0;
  return (
    <div ref={box} className="relative" style={{ height: H }}>
      {w > 0 && (
        <svg width={w} height={H} className="absolute inset-0 overflow-visible" aria-hidden>
          {grid.map((v, i) => (
            <g key={i}>
              <line x1={0} x2={w} y1={y(v)} y2={y(v)} className="stroke-line-strong" strokeDasharray={i === 1 ? '2 4' : undefined} />
              <text x={4} y={y(v) - 4} className="fill-ink-3 font-mono" style={TICK}>{tl.label(v)}</text>
            </g>
          ))}
          {tl.reference && (
            <g>
              <line x1={0} x2={w} y1={y(tl.reference.value)} y2={y(tl.reference.value)} strokeDasharray="3 4" className="stroke-ink-3" />
              <text x={56} y={y(tl.reference.value) + 13} className="fill-ink-2" style={TICK}>{tl.reference.label}</text>
            </g>
          )}
          {tl.injects.map((inj, k) => {
            const ix = ((inj.round - 1) / cols) * w;
            return (
              <g key={k}>
                <line x1={ix} x2={ix} y1={4} y2={H - 4} strokeDasharray="2 3" className="stroke-ink-3" />
                <title>{`Added in period ${inj.round}: ${inj.text}`}</title>
                <circle cx={ix} cy={6} r={3} className="fill-ink-2" />
              </g>
            );
          })}
          {band.length > 1 && (
            <path d={`${smooth(band.map(p => [x(p.i), y(p.high!)]))} L${band.slice().reverse().map(p => `${x(p.i)},${y(p.low!)}`).join(' L')} Z`} className="fill-gold/10" />
          )}
          {pts.length > 1 && <path d={smooth(pts.map(p => [x(p.i), y(p.value)]))} fill="none" strokeWidth={1.5} className="stroke-gold" />}
          {tl.final && pts.length > 0 && (
            <line x1={x(pts[pts.length - 1].i)} x2={finalX} y1={y(pts[pts.length - 1].value)} y2={y(tl.final.value)} strokeDasharray="3 3" className="stroke-gold/70" />
          )}
          {pts.map(p => (
            <g key={p.i}>
              {p.low !== null && p.high !== null && <line x1={x(p.i)} x2={x(p.i)} y1={y(p.high)} y2={y(p.low)} className="stroke-gold/45" />}
              <circle cx={x(p.i)} cy={y(p.value)} r={3.5} strokeWidth={1.5} className="fill-gold stroke-surface-1" />
              <text x={x(p.i)} y={y(p.value) - 9} textAnchor="middle" className="fill-ink-1 stroke-surface-1" style={HALO}><Figures svg text={p.label} /></text>
            </g>
          ))}
          {tl.final && (
            <g>
              {tl.final.low !== null && tl.final.high !== null && <line x1={finalX} x2={finalX} y1={y(tl.final.high)} y2={y(tl.final.low)} strokeWidth={2} className="stroke-gold/50" />}
              <rect x={finalX - 4.5} y={y(tl.final.value) - 4.5} width={9} height={9} transform={`rotate(45 ${finalX} ${y(tl.final.value)})`} className="fill-gold" />
              <text x={finalX} y={y(tl.final.value) - 11} textAnchor="middle" className="fill-gold stroke-surface-1" style={{ ...HALO, fontWeight: 600 }}><Figures svg text={tl.final.label} /></text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

function LaneRow({ s, lane, tl, cols, template, win, selected, onSelect }: {
  s: RunState; lane: TimelineLane; tl: Timeline; cols: number; template: string; win: [number, number]; selected: string | null; onSelect: (k: string | null) => void;
}) {
  const at = (v: number) => Math.min(100, Math.max(0, ((v - win[0]) / (win[1] - win[0] || 1)) * 100));
  const world = lane.key.slice(2);
  const on = selected === lane.key;
  const pick = (k: string) => onSelect(selected === k ? null : k);
  const deciding = (r: number) => Object.entries(s.thinking).some(([k, p]) => k.startsWith(`${world}:`) && p === r);
  return (
    <div className={cx('grid w-full items-stretch border-b border-line', on && 'bg-surface-3')} style={{ gridTemplateColumns: template }}>
      <button type="button" onClick={() => pick(lane.key)} aria-pressed={on}
        className={cx('sticky left-0 z-10 flex min-w-0 items-start gap-2 px-3 py-2 text-left', on ? 'bg-surface-3' : 'bg-surface-1 hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-control bg-surface-3 text-gold"><TypeIcon k={lane.key} className="size-3.5" /></span>
        <span className="min-w-0">
          <span className="block truncate text-small font-medium text-ink-1">{lane.name}</span>
          <span className="line-clamp-2 block text-meta text-ink-3">{lane.role}</span>
        </span>
      </button>
      {tl.rounds.map((r, idx) => {
        const cell = lane.cells[idx];
        const prev = lane.cells.slice(0, idx).reverse().find((c): c is TimelineCell => c !== null) ?? null;
        if (!cell) {
          return (
            <span key={r} className="px-2.5 py-2 text-small text-ink-4">
              {deciding(r) ? <LoaderCircle aria-label="Deciding" className="size-3.5 animate-spin text-ink-3 motion-reduce:animate-none" /> : '—'}
            </span>
          );
        }
        return (
          <span key={r} className="flex min-w-0 flex-col gap-1.5 px-2.5 py-2">
            <button type="button" onClick={() => pick(lane.key)} title={cell.point.note || undefined} className={cx('rounded-control text-left', FOCUS_RING)}>
              <span className="flex items-center gap-1.5">
                <span className="truncate text-small text-ink-1">
                  {cell.point.resolved && <span className="text-ink-3">Resolved · </span>}<Figures text={cell.label} />
                </span>
                <Delta s={s} cell={cell} prev={prev} />
              </span>
              <span className="relative mt-1.5 block h-0.5 rounded-full bg-surface-3">
                <span className={cx('absolute top-1/2 -mt-[3.5px] -ml-[3.5px] size-[7px] rounded-full', on ? 'bg-gold' : 'bg-ink-2')} style={{ left: `${at(cell.value)}%` }} />
              </span>
              {cell.point.price && s.quant && s.frame?.kind !== 'number' && (
                <span className="mt-1 block text-meta text-ink-3">{s.quant.symbol} <span className="font-mono tabular-nums">{priceText(cell.point.price.close, s.quant.currency)}</span></span>
              )}
            </button>
            {cell.events.slice(0, 3).map(e => {
              const key = `e:${e.id}`;
              const marked = e.kind === 'shock' || e.kind === 'injected';
              return (
                <button key={e.id} type="button" onClick={() => pick(key)} title={`${fmtDate(e.date)} · ${e.title}`}
                  className={cx('flex items-start gap-1.5 rounded-control text-left text-meta', selected === key ? 'text-ink-1' : 'text-ink-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
                  <TypeIcon k={key} subtype={e.kind} className={cx('mt-0.5 size-3 shrink-0', marked ? 'text-gold' : 'text-ink-3')} />
                  <span className="line-clamp-2">{e.title}</span>
                </button>
              );
            })}
            {cell.events.length > 3 && (
              <button type="button" onClick={() => pick(lane.key)} className={cx('self-start rounded-control text-meta text-ink-3 hover:text-ink-1', FOCUS_RING)}>
                <span className="font-mono tabular-nums">{cell.events.length - 3}</span> more
              </button>
            )}
          </span>
        );
      })}
      {cols > tl.rounds.length && <Drift s={s} lane={lane} />}
    </div>
  );
}

export function TimelineView({ s, selected, onSelect }: { s: RunState; selected: string | null; onSelect: (k: string | null) => void }) {
  const tl = useMemo(() => timelineOf(s), [s]);
  const cols = tl.rounds.length + (s.report ? 1 : 0);
  const template = `${NAME_COL}px repeat(${cols}, minmax(${MIN_COL}px, 1fr))`;
  const win = useMemo(() => windowOf(tl), [tl]);

  if (!castOf(s).length || !s.worlds.length) {
    return <div className="flex h-full items-center justify-center"><EmptyState icon={GanttChart} title="Nothing on the timeline yet" body="It fills in once the actors are cast and the worlds start to run." /></div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-ink-1">Timeline</h3>
          <p className="mt-0.5 truncate text-meta text-ink-3">
            {plural(tl.rounds.length, 'period')} · {plural(tl.lanes.length, 'world')} · {plural(s.events.length, 'event')}{tl.injects.length ? ` · ${tl.injects.length} added by you` : ''}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-4 text-meta text-ink-2">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-gold" />Pooled</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gold/20" />Range</span>
          {tl.reference && <span className="inline-flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-ink-3" />{s.frame?.kind === 'number' ? 'Today' : 'Base rate'}</span>}
          {tl.injects.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-ink-2" />Added event</span>}
        </div>
      </div>
      <div className="styled-scrollbar min-h-0 flex-1 overflow-auto">
        <div style={{ minWidth: NAME_COL + cols * MIN_COL }}>
          <div className="grid border-b border-line" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-10 flex flex-col gap-1 bg-surface-1 px-3 py-3">
              <span className="text-small font-medium text-ink-2">The worlds pooled</span>
              <span className="text-meta text-ink-3">
                {s.frame?.kind === 'number' ? 'The worlds’ median, with their range' : s.frame?.kind === 'choice' ? 'The leading outcome’s pooled share' : 'Chance of yes across the worlds, with their range'}
              </span>
            </div>
            <div style={{ gridColumn: `2 / span ${cols}` }} className="py-1"><PooledChart tl={tl} cols={cols} win={win} /></div>
          </div>
          <div className="sticky top-0 z-20 grid border-b border-line-strong bg-surface-1" style={{ gridTemplateColumns: template }}>
            <span className="sticky left-0 bg-surface-1 px-3 py-2 text-meta font-medium text-ink-3">World</span>
            {tl.rounds.map(r => {
              const st = s.rounds.find(x => x.round === r);
              const live = !st && s.status === 'running' && s.phase === 'simulate' && s.steps.filter(x => x.phase === 'simulate').length === r;
              const period = tl.periods.find(p => p.index === r);
              return (
                <span key={r} className="flex flex-col gap-0.5 px-2.5 py-2">
                  <span className={cx('inline-flex items-center gap-1.5 text-meta font-medium', live ? 'text-ink-1' : st ? 'text-ink-2' : 'text-ink-3')}>
                    <span>Period <span className="font-mono tabular-nums">{r}</span></span>{live && <Dot tone="gold" pulse label="Running now" />}
                  </span>
                  {period && <span className="truncate text-meta text-ink-3">{period.label}</span>}
                </span>
              );
            })}
            {cols > tl.rounds.length && <span className="px-2.5 py-2 text-meta font-medium text-ink-2">Final · drift</span>}
          </div>
          {tl.lanes.map(lane => (
            <LaneRow key={lane.key} s={s} lane={lane} tl={tl} cols={cols} template={template} win={win} selected={selected} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}
