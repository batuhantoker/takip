'use client';

import { useMemo } from 'react';
import { Star } from 'lucide-react';
import {
  formatMove, formatNet, formatPrice, formatVolume, monthChange, netChange, rangePosition, tradeTime,
  type MarketQuote as Quote, type SortKey,
} from '@/lib/markets';
import { T, moveColor } from '@/lib/markets-terminal';

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
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="inline-block overflow-visible align-middle" aria-hidden="true">
      <path d={path} fill="none" stroke={moveColor(monthChange(points))} strokeWidth="1" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

/** Where the price sits between two extremes: a hairline track and a tick. */
function RangeBar({ pos, title }: { pos: number | null; title: string }) {
  return (
    <span className="relative inline-block w-14 h-2 align-middle" title={title}>
      <span className="absolute inset-x-0 top-1/2 h-px rounded-full" style={{ background: T.line }} />
      {pos != null && <span className="absolute top-0 h-2 w-[2px] rounded-full" style={{ left: `calc(${(pos * 100).toFixed(1)}% - 1px)`, background: T.accent }} />}
    </span>
  );
}

function SortHeader({ label, k, sort, onSort, className = '' }: {
  label: string; k: SortKey; sort: { key: SortKey; asc: boolean }; onSort: (k: SortKey) => void; className?: string;
}) {
  const active = sort.key === k;
  return (
    <th scope="col" className={`font-normal ${className}`} aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => onSort(k)} className="hover:text-[var(--text-primary)] transition-colors" style={{ color: active ? T.accent : undefined }}>
        {label}{active ? (sort.asc ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
}

/**
 * The monitor: one row per security. Columns appear as the table's own width
 * allows (container queries), so the same table is a compact board docked and
 * a full monitor in full screen.
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
      <table className="w-full border-collapse font-mono text-[11px] tabular-nums">
        <thead className="sticky top-0 z-10 bg-[var(--bg-panel-solid)]">
          <tr className="text-[9px] tracking-wider text-left border-b border-[var(--border-secondary)] text-[var(--text-muted)]">
            <th scope="col" className="w-5 font-normal"><span className="sr-only">Watch</span></th>
            <SortHeader label="SECURITY" k="name" sort={sort} onSort={onSort} className="py-1.5" />
            <th scope="col" className="font-normal text-right pr-2">LAST</th>
            <th scope="col" className="font-normal text-right pr-2 hidden @2xl:table-cell">NET</th>
            <SortHeader label="%CHG" k="move" sort={sort} onSort={onSort} className="text-right pr-2" />
            <SortHeader label="1M" k="month" sort={sort} onSort={onSort} className="text-right pr-1 hidden @min-[20rem]:table-cell" />
            <th scope="col" className="font-normal text-center px-2 hidden @2xl:table-cell">DAY RANGE</th>
            <th scope="col" className="font-normal text-center px-2 hidden @3xl:table-cell">52W</th>
            <th scope="col" className="font-normal text-right pl-3 pr-2 hidden @4xl:table-cell">VOLUME</th>
            <th scope="col" className="font-normal text-right pl-3 pr-1 hidden @3xl:table-cell">TIME</th>
          </tr>
        </thead>
        {groups.map((g, gi) => (
          <tbody key={g.label ?? gi}>
            {g.label && (
              <tr>
                <td colSpan={10} className="pt-2.5 pb-1 pl-1 text-[9px] tracking-[0.2em]" style={{ color: T.accent }}>{g.label}</td>
              </tr>
            )}
            {g.rows.map(q => {
              const active = selected === q.symbol;
              const starred = watchlist.includes(q.symbol);
              const net = netChange(q);
              const month = monthChange(q.spark);
              return (
                <tr
                  key={q.symbol}
                  onClick={() => onOpen(q)}
                  className="cursor-pointer odd:bg-white/[0.015] hover:bg-[var(--hover-accent)] transition-colors"
                  style={active ? { background: 'var(--hover-accent)', boxShadow: `inset 2px 0 0 ${T.accent}` } : undefined}
                >
                  <td className="w-5 text-center">
                    <button
                      onClick={e => { e.stopPropagation(); onStar(q.symbol); }}
                      aria-label={starred ? `Remove ${q.name} from watchlist` : `Add ${q.name} to watchlist`}
                      aria-pressed={starred}
                      className="p-0.5 align-middle"
                    >
                      <Star className="w-2.5 h-2.5" fill={starred ? 'currentColor' : 'none'} style={{ color: starred ? T.accent : T.faint }} />
                    </button>
                  </td>
                  <td className="py-[4px] pr-2 max-w-0 w-full">
                    <button
                      onClick={e => { e.stopPropagation(); onOpen(q); }}
                      className="flex items-baseline gap-1.5 min-w-0 w-full text-left"
                      title={`${q.description || q.name} — ${q.symbol}${q.exchange ? ` · ${q.exchange}` : ''}`}
                    >
                      <span className="font-bold truncate shrink-0 max-w-[60%]" style={{ color: active ? T.accent : T.text }}>{q.name}</span>
                      <span className="text-[9px] truncate" style={{ color: T.faint }}>{q.description && q.description !== q.name ? q.description : q.symbol}</span>
                    </button>
                  </td>
                  <td className="text-right pr-2 whitespace-nowrap" style={{ color: T.text }}>{formatPrice(q)}</td>
                  <td className="text-right pr-2 whitespace-nowrap hidden @2xl:table-cell" style={{ color: moveColor(net) }}>{formatNet(q, net)}</td>
                  <td className="text-right pr-2 whitespace-nowrap font-bold" style={{ color: moveColor(q.change_percent) }}>{formatMove(q.change_percent)}</td>
                  <td className="text-right pr-1 whitespace-nowrap hidden @min-[20rem]:table-cell" title={`One month ${formatMove(month)}`}><Spark points={q.spark} /></td>
                  <td className="text-center px-2 hidden @2xl:table-cell">
                    <RangeBar
                      pos={rangePosition(q.price, q.day_low, q.day_high)}
                      title={q.day_low != null && q.day_high != null ? `Day ${formatPrice(q, q.day_low)} – ${formatPrice(q, q.day_high)}` : 'No day range'}
                    />
                  </td>
                  <td className="text-center px-2 hidden @3xl:table-cell">
                    <RangeBar
                      pos={rangePosition(q.price, q.low_52w, q.high_52w)}
                      title={q.low_52w != null && q.high_52w != null ? `52 weeks ${formatPrice(q, q.low_52w)} – ${formatPrice(q, q.high_52w)}` : 'No 52-week range'}
                    />
                  </td>
                  <td className="text-right pl-3 pr-2 hidden @4xl:table-cell" style={{ color: T.dim }}>{formatVolume(q.volume)}</td>
                  <td className="text-right pl-3 pr-1 hidden @3xl:table-cell" style={{ color: q.market_open ? T.text : T.faint }}>{tradeTime(q.time, now)}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
