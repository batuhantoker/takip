'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   OSIRIS — Markets Panel
   Defense stocks + oil prices ticker
   ═══════════════════════════════════════════════════════════════ */

interface MarketsPanelProps {
  data: any;
}

export default function MarketsPanel({ data }: MarketsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const stocks = data.stocks || {};
  const oil = data.oil || {};

  const hasData = Object.keys(stocks).length > 0 || Object.keys(oil).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="glass-panel overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--hover-accent)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          <span className="hud-text text-[10px] text-[var(--text-primary)]">MARKETS</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" /> : <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {!hasData ? (
                <div className="py-3 text-center">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] tracking-widest animate-osiris-pulse">
                    LOADING MARKET DATA...
                  </span>
                </div>
              ) : (
                <>
                  {/* Defense Stocks */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {Object.entries(stocks).map(([symbol, info]: [string, any]) => (
                      <div key={symbol} className="glass-panel-sm px-2 py-1.5 text-center">
                        <div className="text-[8px] font-mono text-[var(--text-muted)] tracking-wider">{symbol}</div>
                        <div className="text-[11px] font-mono font-bold text-[var(--text-primary)]">${info.price}</div>
                        <div className={`flex items-center justify-center gap-0.5 text-[8px] font-mono ${info.up ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}`}>
                          {info.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          {info.up ? '+' : ''}{info.change_percent}%
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Oil Prices */}
                  {Object.keys(oil).length > 0 && (
                    <div className="flex gap-2">
                      {Object.entries(oil).map(([name, info]: [string, any]) => (
                        <div key={name} className="flex-1 glass-panel-sm px-2 py-1.5">
                          <div className="text-[7px] font-mono text-[var(--text-muted)] tracking-wider">{name}</div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">${info.price}</span>
                            <span className={`text-[8px] font-mono ${info.up ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}`}>
                              {info.up ? '+' : ''}{info.change_percent}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
