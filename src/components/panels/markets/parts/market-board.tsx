'use client';

import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { PanelSection } from '@/components/ui/panel';
import {
  PULSE, formatMove, formatPrice, longName,
  type FunctionCode, type MarketQuote as Quote,
} from '@/lib/markets/markets';
import { FEED_SECTIONS, SECTION_OF } from '@/lib/markets/terminal';
import { heatTint, moveTone, pulseLabel, sectionTitle } from '@/components/panels/markets/markets-format';

interface MarketBreadth { up: number; down: number; flat: number; total: number; best: Quote[]; worst: Quote[] }

const TILE = cx('min-w-0 rounded-control px-2 py-1.5 text-left disabled:opacity-40', FOCUS_RING, TRANSITION);

/** The benchmarks everyone checks first, one tile each. */
export function PulseMonitor({ bySymbol, chartSymbol, open, maximized }: {
  bySymbol: Map<string, Quote>;
  chartSymbol: string | null;
  open: (q: { symbol: string }) => void;
  maximized: boolean;
}) {
  return (
    <div className={cx('-mx-2 grid gap-1', maximized ? 'grid-cols-4 xl:grid-cols-8' : 'grid-cols-4')}>
      {PULSE.map(({ symbol, label }) => {
        const q = bySymbol.get(symbol);
        return (
          <button key={symbol} type="button" onClick={() => q && open(q)} disabled={!q}
            aria-pressed={chartSymbol === symbol}
            title={q ? `Chart ${longName(q)}` : `${pulseLabel(label)}: no reading`}
            className={cx(TILE, chartSymbol === symbol ? 'bg-surface-3' : 'hover:bg-surface-2')}>
            <span className="block truncate text-meta text-ink-3">{pulseLabel(label)}</span>
            <span className={cx('block truncate font-mono text-ink-1 tabular-nums', maximized ? 'text-title' : 'text-small')}>{q ? formatPrice(q) : '—'}</span>
            <span className={cx('block font-mono text-meta tabular-nums', moveTone(q?.change_percent))}>{formatMove(q?.change_percent)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** How much of everything rose today, and the biggest move each way. */
export function BreadthCard({ breadth, open }: { breadth: MarketBreadth; open: (q: { symbol: string }) => void }) {
  const best = breadth.best[0], worst = breadth.worst[0];
  const pct = (n: number) => `${(n / breadth.total) * 100}%`;
  return (
    <div>
      <p className="text-small text-ink-2 tabular-nums">
        <span className="font-medium text-green">{breadth.up}</span> up · <span className="font-medium text-red">{breadth.down}</span> down
        {breadth.flat > 0 && <> · {breadth.flat} flat</>}
        <span className="text-ink-3"> of {breadth.total}</span>
      </p>
      <span aria-hidden className="mt-2 flex h-1 overflow-hidden rounded-full bg-surface-3">
        <span className="bg-green" style={{ width: pct(breadth.up) }} />
        <span className="bg-ink-4" style={{ width: pct(breadth.flat) }} />
        <span className="bg-red" style={{ width: pct(breadth.down) }} />
      </span>
      <div className="mt-2 flex items-center justify-between gap-3 text-small">
        <button type="button" onClick={() => open(best)} className={cx('min-w-0 truncate rounded-[4px] text-left text-ink-2 hover:text-ink-1', FOCUS_RING)}>
          Best: {best.name} <span className="font-mono text-green tabular-nums">{formatMove(best.change_percent)}</span>
        </button>
        <button type="button" onClick={() => open(worst)} className={cx('min-w-0 truncate rounded-[4px] text-right text-ink-2 hover:text-ink-1', FOCUS_RING)}>
          Worst: {worst.name} <span className="font-mono text-red tabular-nums">{formatMove(worst.change_percent)}</span>
        </button>
      </div>
    </div>
  );
}

export function MarketHeatmap({ allQuotes, chartSymbol, open, setFn }: {
  allQuotes: Quote[];
  chartSymbol: string | null;
  open: (q: { symbol: string }) => void;
  setFn: (code: FunctionCode) => void;
}) {
  return (
    <PanelSection title="Today’s moves">
      <div className="flex flex-col gap-2">
        {FEED_SECTIONS.map(s => {
          const quotes = allQuotes.filter(q => q.group === s);
          if (!quotes.length) return null;
          return (
            <div key={s} className="flex items-start gap-2">
              <button type="button" onClick={() => setFn(SECTION_OF[s])}
                className={cx('w-24 shrink-0 truncate rounded-[4px] pt-1.5 text-left text-meta text-ink-3 hover:text-ink-1', FOCUS_RING)}>
                {sectionTitle(SECTION_OF[s])}
              </button>
              <div className="flex flex-1 flex-wrap gap-1">
                {quotes.map(q => (
                  <button key={q.symbol} type="button" onClick={() => open(q)} title={`${longName(q)} ${formatMove(q.change_percent)}`}
                    className={cx('w-[96px] rounded-[4px] border px-1.5 py-1 text-left', chartSymbol === q.symbol && 'ring-1 ring-ink-1', FOCUS_RING)}
                    style={heatTint(q.change_percent)}>
                    <span className="block truncate text-meta text-ink-1">{q.name}</span>
                    <span className={cx('block font-mono text-meta font-medium tabular-nums', moveTone(q.change_percent))}>{formatMove(q.change_percent)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </PanelSection>
  );
}

export function Movers({ breadth, open }: { breadth: MarketBreadth; open: (q: { symbol: string }) => void }) {
  return (
    <PanelSection title="Biggest moves, all markets">
      <div className="grid grid-cols-2 gap-4">
        {[breadth.best, breadth.worst].map((list, col) => (
          <ul key={col}>
            {list.map(q => (
              <li key={q.symbol}>
                <button type="button" onClick={() => open(q)}
                  className={cx('-mx-1.5 flex w-[calc(100%+12px)] items-baseline justify-between gap-2 rounded-[4px] px-1.5 py-1 text-small hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                  <span className="truncate text-ink-1">{q.name}</span>
                  <span className={cx('font-mono tabular-nums', moveTone(q.change_percent))}>{formatMove(q.change_percent)}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </PanelSection>
  );
}
