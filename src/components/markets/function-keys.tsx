'use client';

import type { ComponentType, CSSProperties } from 'react';
import { Bitcoin, DollarSign, Droplets, Gem, LineChart, Shield, Star } from 'lucide-react';
import { FUNCTIONS, type FunctionCode } from '@/lib/markets';
import DigitalDonMark from './digital-don-mark';

/** One icon per function key, as RECON gives one to each tool. */
const ICONS: Record<FunctionCode, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  WEI: LineChart, DEF: Shield, NRG: Droplets, CMDTY: Gem, FX: DollarSign, CRYPTO: Bitcoin, WATCH: Star, DON: DigitalDonMark,
};

export default function FunctionKeys({ fn, setFn, maximized }: {
  fn: FunctionCode | 'HELP';
  setFn: (code: FunctionCode) => void;
  maximized: boolean;
}) {
  return (
    <div className={`grid gap-1 ${maximized ? 'grid-cols-4 lg:grid-cols-8' : 'grid-cols-4'}`}>
      {FUNCTIONS.map(f => {
        const active = fn === f.code;
        const Icon = ICONS[f.code];
        return (
          <button
            key={f.code}
            onClick={() => setFn(f.code)}
            aria-pressed={active}
            title={`${f.key} · ${f.code} — ${f.title}`}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[9px] font-mono tracking-wider transition-colors ${
              active
                ? 'bg-[var(--hover-accent)] border-[var(--border-active)] text-[var(--gold-primary)]'
                : 'border-[var(--border-secondary)] text-[var(--text-secondary)] hover:bg-[var(--hover-accent)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span className="truncate">{f.code}</span>
            <span className="ml-auto text-[8px] opacity-50">{f.key}</span>
          </button>
        );
      })}
    </div>
  );
}
