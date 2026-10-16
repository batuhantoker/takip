'use client';

import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import {
  formatMove, formatNet, formatPrice, formatVolume, monthChange, netChange, rangePosition, tradeTime,
  type MarketQuote as Quote, type SortKey,
} from '@/lib/intel/markets/markets';
import { moveTone, regionLabel } from '@/components/panels/markets/markets-format';

/** A month of closes as one thin path, coloured by the month's direction. */
function Spark({ points }: { points?: number[] }) {
  const W = 48, H = 14;
  const path = useMemo(() => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
    const step = W / (points.length - 1);
    return points.map((p, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(H - ((p - min) / span) * H).toFixed(1)}`).join(' ');
  }, [points]);
  if (!path) return <span className="inline-block" style={{ width: W }} />;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={cx('inline-block overflow-visible align-middle', moveTone(monthChange(points)))} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

/** Where the price sits between two extremes: a hairline track and a tick. */
function RangeBar({ pos, title }: { pos: number | null; title: string }) {
  return (
    <span className="relative inline-block h-2.5 w-14 align-middle" title={title}>
      <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
      {pos != null && <span className="absolute top-0 h-2.5 w-0.5 rounded-full bg-ink-2" style={{ left: `calc(${(pos * 100).toFixed(1)}% - 1px)` }} />}
    </span>
  );
}

function SortHeader({ label, k, sort, onSort, className }: {
  label: string; k: SortKey; sort: { key: SortKey; asc: boolean }; onSort: (k: SortKey) => void; className?: string;
}) {
  const active = sort.key === k;
  const Arrow = sort.asc ? ArrowUp : ArrowDown;
  return (
    <th scope="col" className={cx('font-medium', className)} aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(k)} className={cx('inline-flex items-center gap-1 rounded-[4px] hover:text-ink-1', active && 'text-ink-1', FOCUS_RING, TRANSITION)}>
        {label}{active && <Arrow aria-hidden className="size-3" strokeWidth={2} />}
      </button>
    </th>
  );
}

const NUM = 'text-right font-mono tabular-nums whitespace-nowrap';

/**
 * One row per security. Columns appear as the table's own width allows
 * (container queries): a compact board docked, a full monitor in full screen.
 */
export default function SecurityTable({ groups, selected, watchlist, sort, onSort, onOpen, onStar, now }: {
  groups: { label?: string; rows: Quote[] }[];
  selected: string | null;
  watchlist: string[];
  sort: { key: SortKey; asc: boolean };
  onSort: (k: SortKey) => void;
  onOpen: (q: Quote) => void;
  onStar: (symbol: string) => void;
  now: number;
}) {
  return (
    <div className="@container">
      <table className="w-full border-collapse text-small">
        <thead className="sticky top-0 z-10 bg-surface-1">
          <tr className="border-b border-line text-left text-meta text-ink-3">
            <th scope="col" className="w-7"><span className="sr-only">Watch</span></th>
            <SortHeader label="Name" k="name" sort={sort} onSort={onSort} className="py-2" />
            <th scope="col" className="pr-2 text-right font-medium">Last</th>
            <th scope="col" className="hidden pr-2 text-right font-medium @2xl:table-cell">Net</th>
            <SortHeader label="Change" k="move" sort={sort} onSort={onSort} className="pr-2 text-right" />
            <SortHeader label="Month" k="month" sort={sort} onSort={onSort} className="hidden pr-1 text-right @min-[20rem]:table-cell" />
            <th scope="col" className="hidden px-2 text-center font-medium @2xl:table-cell">Day range</th>
            <th scope="col" className="hidden px-2 text-center font-medium @3xl:table-cell">52 weeks</th>
            <th scope="col" className="hidden pr-2 pl-3 text-right font-medium @4xl:table-cell">Volume</th>
            <th scope="col" className="hidden pr-1 pl-3 text-right font-medium @3xl:table-cell">Time</th>
          </tr>
        </thead>
        {groups.map((g, gi) => (
          <tbody key={g.label ?? gi}>
            {g.label && (
              <tr>
                <th colSpan={10} scope="colgroup" className="pt-4 pb-1.5 pl-1 text-left text-meta font-medium text-ink-3">{regionLabel(g.label)}</th>
              </tr>
            )}
            {g.rows.map(q => {
              const active = selected === q.symbol;
              const starred = watchlist.includes(q.symbol);
              const net = netChange(q);
              const month = monthChange(q.spark);
              return (
                <tr key={q.symbol} onClick={() => onOpen(q)}
                  className={cx('h-9 cursor-pointer border-b border-line last:border-b-0', active ? 'bg-surface-3' : 'hover:bg-surface-2', TRANSITION)}>
                  <td className="w-7 text-center">
                    <button type="button" onClick={e => { e.stopPropagation(); onStar(q.symbol); }}
                      aria-label={starred ? `Remove ${q.name} from your watchlist` : `Add ${q.name} to your watchlist`} aria-pressed={starred}
                      className={cx('inline-flex size-6 items-center justify-center rounded-[4px] align-middle hover:bg-surface-3', starred ? 'text-ink-1' : 'text-ink-4 hover:text-ink-2', FOCUS_RING, TRANSITION)}>
                      <Star aria-hidden className="size-3.5" strokeWidth={1.75} fill={starred ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td className="w-full max-w-0 py-1 pr-2">
                    <button type="button" onClick={e => { e.stopPropagation(); onOpen(q); }}
                      className={cx('flex w-full min-w-0 items-baseline gap-1.5 rounded-[4px] text-left', FOCUS_RING)}
                      title={`${q.description || q.name} · ${q.symbol}${q.exchange ? ` · ${q.exchange}` : ''}`}>
                      <span className="min-w-0 truncate text-body font-medium text-ink-1 @md:max-w-[60%] @md:shrink-0">{q.name}</span>
                      <span className="hidden truncate text-meta text-ink-3 @md:inline">{q.description && q.description !== q.name ? q.description : q.symbol}</span>
                    </button>
                  </td>
                  <td className={cx(NUM, 'pr-2 text-ink-1')}>{formatPrice(q)}</td>
                  <td className={cx(NUM, 'hidden pr-2 @2xl:table-cell', moveTone(net))}>{formatNet(q, net)}</td>
                  <td className={cx(NUM, 'pr-2', moveTone(q.change_percent))}>{formatMove(q.change_percent)}</td>
                  <td className="hidden pr-1 text-right whitespace-nowrap @min-[20rem]:table-cell" title={`One month ${formatMove(month)}`}><Spark points={q.spark} /></td>
                  <td className="hidden px-2 text-center @2xl:table-cell">
                    <RangeBar pos={rangePosition(q.price, q.day_low, q.day_high)}
                      title={q.day_low != null && q.day_high != null ? `Today ${formatPrice(q, q.day_low)} to ${formatPrice(q, q.day_high)}` : 'No day range'} />
                  </td>
                  <td className="hidden px-2 text-center @3xl:table-cell">
                    <RangeBar pos={rangePosition(q.price, q.low_52w, q.high_52w)}
                      title={q.low_52w != null && q.high_52w != null ? `52 weeks ${formatPrice(q, q.low_52w)} to ${formatPrice(q, q.high_52w)}` : 'No 52-week range'} />
                  </td>
                  <td className={cx(NUM, 'hidden pr-2 pl-3 text-ink-2 @4xl:table-cell')}>{formatVolume(q.volume)}</td>
                  <td className={cx(NUM, 'hidden pr-1 pl-3 @3xl:table-cell', q.market_open ? 'text-ink-1' : 'text-ink-3')}>{tradeTime(q.time, now)}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
