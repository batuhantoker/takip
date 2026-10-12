'use client';

import {
  PULSE, formatMove, formatPrice, heat, longName,
  type FunctionCode, type MarketQuote as Quote,
} from '@/lib/markets';
import { FEED_SECTIONS, SECTION_OF, T, moveColor } from '@/lib/markets-terminal';

interface MarketBreadth { up: number; down: number; flat: number; total: number; best: Quote[]; worst: Quote[] }

/** The benchmarks everyone checks first, one tile each. */
export function PulseMonitor({ bySymbol, chartSymbol, open, maximized }: {
  bySymbol: Map<string, Quote>;
  chartSymbol: string | null;
  open: (q: { symbol: string }) => void;
  maximized: boolean;
}) {
  return (
    <div className={`grid gap-1 ${maximized ? 'grid-cols-4 xl:grid-cols-8' : 'grid-cols-4'}`}>
      {PULSE.map(({ symbol, label }) => {
        const q = bySymbol.get(symbol);
        const active = chartSymbol === symbol;
        return (
          <button
            key={symbol}
            onClick={() => q && open(q)}
            disabled={!q}
            title={q ? `${longName(q)} — chart it` : `${label} — no reading`}
            className={`min-w-0 px-2 py-1.5 rounded-md border text-left font-mono transition-colors disabled:opacity-40 ${
              active ? 'border-[var(--border-active)] bg-[var(--hover-accent)]' : 'border-[var(--border-secondary)] bg-white/[0.02] hover:bg-[var(--hover-accent)]'
            }`}
          >
            <div className="text-[8px] tracking-widest truncate" style={{ color: T.dim }}>{label}</div>
            <div className="text-[11px] font-bold tabular-nums truncate" style={{ color: T.text }}>{q ? formatPrice(q) : '—'}</div>
            <div className="text-[9px] font-bold tabular-nums" style={{ color: moveColor(q?.change_percent) }}>{formatMove(q?.change_percent)}</div>
          </button>
        );
      })}
    </div>
  );
}

export function BreadthCard({ breadth, open }: { breadth: MarketBreadth; open: (q: { symbol: string }) => void }) {
  return (
    <div className="px-2.5 py-2 rounded-lg border border-[var(--border-secondary)] bg-white/[0.02] font-mono text-[10px] tabular-nums">
      <div className="flex items-center gap-2">
        <span className="text-[9px] tracking-widest" style={{ color: T.faint }}>BREADTH</span>
        <span style={{ color: T.up }}>{breadth.up}▲</span>
        <span style={{ color: T.down }}>{breadth.down}▼</span>
        {breadth.flat > 0 && <span style={{ color: T.dim }}>{breadth.flat} unch</span>}
        <span className="flex-1 h-1 rounded-full flex overflow-hidden" aria-hidden="true">
          <span style={{ width: `${(breadth.up / breadth.total) * 100}%`, background: T.up }} />
          <span style={{ width: `${(breadth.flat / breadth.total) * 100}%`, background: T.faint }} />
          <span style={{ width: `${(breadth.down / breadth.total) * 100}%`, background: T.down }} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <button className="truncate hover:underline" onClick={() => open(breadth.best[0])} style={{ color: T.up }}>▲ {breadth.best[0].name} {formatMove(breadth.best[0].change_percent)}</button>
        <button className="truncate hover:underline" onClick={() => open(breadth.worst[0])} style={{ color: T.down }}>▼ {breadth.worst[0].name} {formatMove(breadth.worst[0].change_percent)}</button>
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
    <div className="p-2.5 rounded-lg border border-[var(--border-secondary)] bg-white/[0.02]">
      <div className="text-[9px] font-mono tracking-widest pb-1.5" style={{ color: T.faint }}>HEATMAP · TODAY&apos;S MOVE</div>
      <div className="space-y-1">
        {FEED_SECTIONS.map(s => {
          const quotes = allQuotes.filter(q => q.group === s);
          if (!quotes.length) return null;
          return (
            <div key={s} className="flex items-stretch gap-1">
              <button onClick={() => setFn(SECTION_OF[s])} className="w-12 shrink-0 text-left text-[9px] font-mono tracking-wider pt-1 hover:text-[var(--text-primary)]" style={{ color: T.faint }}>{SECTION_OF[s]}</button>
              <div className="flex flex-wrap gap-1 flex-1">
                {quotes.map(q => {
                  const tint = heat(q.change_percent);
                  return (
                    <button
                      key={q.symbol}
                      onClick={() => open(q)}
                      title={`${longName(q)} ${formatMove(q.change_percent)}`}
                      className="w-[92px] px-1.5 py-1 rounded-sm border text-left font-mono transition-transform hover:scale-[1.03]"
                      style={{ background: tint.background, borderColor: chartSymbol === q.symbol ? T.accent : tint.border }}
                    >
                      <div className="text-[9px] truncate" style={{ color: T.text }}>{q.name}</div>
                      <div className="text-[10px] font-bold tabular-nums" style={{ color: moveColor(q.change_percent) }}>{formatMove(q.change_percent)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Movers({ breadth, open }: { breadth: MarketBreadth; open: (q: { symbol: string }) => void }) {
  return (
    <div className="p-2.5 rounded-lg border border-[var(--border-secondary)] bg-white/[0.02]">
      <div className="text-[9px] font-mono tracking-widest pb-1.5" style={{ color: T.faint }}>MOVERS · ALL MARKETS</div>
      <div className="grid grid-cols-2 gap-3 text-[10px] font-mono tabular-nums">
        {[breadth.best, breadth.worst].map((list, col) => (
          <div key={col}>
            {list.map(q => (
              <button key={q.symbol} onClick={() => open(q)} className="w-full flex justify-between gap-2 px-1 py-[3px] rounded hover:bg-[var(--hover-accent)]">
                <span className="truncate" style={{ color: T.text }}>{q.name}</span>
                <span style={{ color: moveColor(q.change_percent) }}>{formatMove(q.change_percent)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
