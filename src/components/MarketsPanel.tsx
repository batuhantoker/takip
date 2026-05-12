'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, BarChart3, Zap, Globe } from 'lucide-react';

interface MarketsPanelProps { data: any; spaceWeather?: any; }

const SECTIONS = [
  { key: 'indices', label: 'INDICES', emoji: '📊' },
  { key: 'stocks', label: 'DEFENSE', emoji: '🛡️' },
  { key: 'oil', label: 'ENERGY', emoji: '🛢️' },
  { key: 'commodities', label: 'COMMODITIES', emoji: '🏦' },
  { key: 'crypto', label: 'CRYPTO', emoji: '₿' },
];

function Ticker({ name, data: d }: { name: string; data: any }) {
  if (!d) return null;
  return (
    <div className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[var(--hover-accent)] transition-colors">
      <span className="text-[8px] font-mono text-[var(--text-secondary)] tracking-wide">{name}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-mono font-bold text-[var(--text-primary)] tabular-nums">
          {d.price >= 1000 ? `${(d.price / 1000).toFixed(1)}K` : d.price?.toFixed(2)}
        </span>
        <span className={`text-[7px] font-mono font-bold flex items-center gap-0.5 ${d.up ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}`}>
          {d.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {d.change_percent > 0 ? '+' : ''}{d.change_percent?.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default function MarketsPanel({ data, spaceWeather }: MarketsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState('stocks');
  const markets = data.markets || {};

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.6 }} className="glass-panel p-3 pointer-events-auto">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          <span className="hud-text text-[10px] text-[var(--text-primary)]">MARKETS & INTEL</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--alert-green)] animate-osiris-pulse" />
          {expanded ? <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" /> : <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            {/* Space Weather Banner */}
            {spaceWeather && (
              <div className="mb-2 p-2 rounded-lg border" style={{ borderColor: `${spaceWeather.storm_color}33`, background: `${spaceWeather.storm_color}08` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3" style={{ color: spaceWeather.storm_color }} />
                    <span className="text-[7px] font-mono tracking-widest text-[var(--text-muted)]">SPACE WEATHER</span>
                  </div>
                  <span className="text-[8px] font-mono font-bold" style={{ color: spaceWeather.storm_color }}>
                    Kp {spaceWeather.kp_index} — {spaceWeather.storm_level}
                  </span>
                </div>
                {spaceWeather.solar_flares?.length > 0 && (
                  <div className="mt-1 text-[7px] font-mono text-[var(--text-muted)]">
                    Latest flare: {spaceWeather.solar_flares[0].class}
                  </div>
                )}
              </div>
            )}

            {/* Section Tabs */}
            <div className="flex gap-0.5 mb-2 overflow-x-auto">
              {SECTIONS.map(s => (
                <button key={s.key} onClick={() => setActiveSection(s.key)}
                  className={`px-2 py-1 rounded text-[7px] font-mono tracking-wider whitespace-nowrap transition-all ${activeSection === s.key ? 'bg-[var(--hover-accent)] text-[var(--gold-primary)] border border-[var(--border-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent'}`}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>

            {/* Ticker List */}
            <div className="space-y-0.5 max-h-[200px] overflow-y-auto styled-scrollbar">
              {markets[activeSection] && Object.entries(markets[activeSection]).map(([name, d]) => (
                <Ticker key={name} name={name} data={d} />
              ))}
              {(!markets[activeSection] || Object.keys(markets[activeSection]).length === 0) && (
                <div className="text-center py-3 text-[8px] font-mono text-[var(--text-muted)]">Loading {activeSection}...</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
