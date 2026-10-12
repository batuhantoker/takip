'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, ChevronDown, Coffee, ShoppingBag, TrendingUp, type LucideIcon } from 'lucide-react';
import TokenChart from './token-chart';

/* Everything kept off the main screen: Markets, the token chart, and the ways to support the project. */
const LINKS = [
  {
    href: 'https://ko-fi.com/M8D41ZYW4Z',
    Icon: Coffee,
    label: 'SUPPORT ON KO-FI',
    detail: 'Tip once or monthly',
    color: 'var(--gold-primary)',
  },
  {
    href: 'https://shop.osirisai.live/',
    Icon: ShoppingBag,
    label: 'BUY MERCH',
    detail: 'shop.osirisai.live',
    color: 'var(--cyan-primary)',
  },
] as const;

function ItemBody({ Icon, label, detail, color }: { Icon: LucideIcon; label: string; detail: string; color: string }) {
  return (
    <>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} aria-hidden />
      <span className="flex flex-col min-w-0">
        <span className="text-[10px] font-mono font-bold tracking-widest" style={{ color }}>{label}</span>
        <span className="text-[9px] font-mono text-[var(--text-muted)] truncate">{detail}</span>
      </span>
    </>
  );
}

const ITEM = 'w-full text-left flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/5 focus:bg-white/5 focus:outline-none transition-colors';

export default function MoreMenu({ compact = false, onOpenMarkets }: { compact?: boolean; onOpenMarkets: () => void }) {
  const [open, setOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Close on a press anywhere else, or on Escape — which also hands focus back
  // to the button, so a keyboard user is not left stranded.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative pointer-events-auto ${compact ? '' : 'ml-3'}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={`glass-panel flex items-center gap-1.5 text-[9px] font-mono tracking-widest hover:opacity-80 transition-opacity border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10 ${
          compact ? 'px-2 py-1' : 'px-3 py-1.5'
        }`}
      >
        <span className="text-[var(--gold-primary)] font-bold">MORE</span>
        <ChevronDown
          className={`w-2.5 h-2.5 text-[var(--gold-primary)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-[1000] w-60 bg-[#0A0A0A]/95 backdrop-blur-md border border-[var(--gold-primary)]/25 shadow-2xl p-1"
          >
            <button type="button" role="menuitem" className={ITEM} onClick={() => { setOpen(false); onOpenMarkets(); }}>
              <ItemBody Icon={BarChart3} label="MARKETS" detail="Prices, indices, the DonBot token analyzer (M)" color="var(--gold-primary)" />
            </button>
            <button type="button" role="menuitem" className={ITEM} onClick={() => { setOpen(false); setTokenOpen(true); }}>
              <ItemBody Icon={TrendingUp} label="$OSIRIS CHART" detail="Live token chart on Dexscreener" color="#14F195" />
            </button>
            <div className="my-1 h-px bg-white/5" />
            {LINKS.map(({ href, Icon, label, detail, color }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={ITEM}
              >
                <ItemBody Icon={Icon} label={label} detail={detail} color={color} />
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <TokenChart open={tokenOpen} onClose={() => setTokenOpen(false)} />
    </div>
  );
}
