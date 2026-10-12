'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { TakipMark } from '@/components/brand/takip-mark';
import { OiMark } from '@/components/oi/atoms';
import { hudIn } from '@/lib/hud-motion';
import { NAV_WIDTH, type ToolId } from './dock';

export interface NavItem {
  id: ToolId;
  label: string;
  /** The tooltip; name the shortcut key here. */
  title: string;
  icon: LucideIcon;
  badge?: number;
}

const ITEM = 'relative w-full flex flex-col items-center gap-1 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40';

function NavButton({ item, active, onSelect }: { item: NavItem; active: boolean; onSelect: (id: ToolId) => void }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={() => onSelect(item.id)} title={item.title} aria-pressed={active}
      className={`${ITEM} ${active ? 'bg-white/[0.08] text-[var(--text-heading)]' : 'text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]'}`}>
      {active && <span aria-hidden className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--cyan-primary)]" />}
      <span className="relative">
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} style={active ? { color: 'var(--cyan-primary)' } : undefined} />
        {!!item.badge && (
          <span className="absolute -top-1.5 left-3 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--cyan-primary)] text-black text-[9px] font-mono font-bold leading-[15px] text-center tabular-nums">
            {item.badge}
          </span>
        )}
      </span>
      <span className="text-[10.5px] leading-none">{item.label}</span>
    </button>
  );
}

function TiButton({ active, live, running, onSelect }: { active: boolean; live: boolean; running: boolean; onSelect: (id: ToolId) => void }) {
  return (
    <button type="button" onClick={() => onSelect('oi')} aria-pressed={active}
      title="TI, Takip AI: ask it to work the map for you, or run a forecast (T)"
      className={`${ITEM} border ${active
        ? 'border-[var(--gold-primary)]/60 bg-[var(--gold-primary)]/15 shadow-[0_0_16px_rgba(var(--gold-rgb),0.2)]'
        : 'border-[var(--gold-primary)]/25 bg-[var(--gold-primary)]/[0.06] hover:bg-[var(--gold-primary)]/[0.12] hover:border-[var(--gold-primary)]/45'}`}>
      {active && <span aria-hidden className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--gold-primary)]" />}
      <OiMark size={20} live={live} />
      <span className="text-[10.5px] font-semibold leading-none text-[var(--gold-light)]">TI</span>
      {running && <span aria-hidden className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[var(--gold-light)] animate-pulse" />}
    </button>
  );
}

/** The one place to start anything: each entry opens its panel beside the sidebar; TI sits apart in gold. */
export function NavSidebar({ items, active, onSelect, tiLive, tiRunning, footer, revealed }: {
  items: NavItem[];
  active: ToolId | null;
  onSelect: (id: ToolId) => void;
  tiLive: boolean;
  tiRunning: boolean;
  footer: ReactNode;
  revealed: boolean;
}) {
  return (
    <motion.nav data-hud aria-label="Tools"
      initial={{ opacity: 0, x: -16 }} animate={revealed ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }} transition={hudIn(0.15)}
      className="absolute left-0 top-0 bottom-7 z-[260] flex flex-col items-center gap-1 px-2 pt-3 pb-2 bg-[var(--bg-panel)] backdrop-blur-xl border-r border-white/[0.06]"
      style={{ width: NAV_WIDTH }}>
      <div className="mb-3 flex justify-center" title="TAKIP">
        <TakipMark className="h-8 w-auto text-[var(--brand-ink)]" />
      </div>
      {items.map(item => <NavButton key={item.id} item={item} active={active === item.id} onSelect={onSelect} />)}
      <div className="w-8 h-px my-2 bg-white/10" />
      <TiButton active={active === 'oi'} live={tiLive} running={tiRunning} onSelect={onSelect} />
      <div className="flex-1" />
      <div className="w-full flex flex-col items-center gap-1">{footer}</div>
    </motion.nav>
  );
}
