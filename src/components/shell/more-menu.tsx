'use client';

import { useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, ChevronDown, Coffee, Ellipsis, TrendingUp, type LucideIcon } from 'lucide-react';
import { APP_VERSION } from '@/lib/app-version';
import { MENU_ITEM, MENU_PANEL, MENU_PANEL_SIDE, MENU_TRIGGER, RAIL_TRIGGER } from '@/components/ui/menu-styles';
import { useDismiss } from '@/components/ui/use-dismiss';
import TokenChart from './token-chart';

/* Everything kept off the main screen: Markets, the token chart, and the ways to support the project. */
const LINKS = [
  {
    href: 'https://ko-fi.com/M8D41ZYW4Z',
    Icon: Coffee,
    label: 'Support on Ko-fi',
    detail: 'Tip once or monthly',
    color: 'var(--gold-primary)',
  },
] as const;

function ItemBody({ Icon, label, detail, color }: { Icon: LucideIcon; label: string; detail: string; color: string }) {
  return (
    <>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} aria-hidden />
      <span className="flex flex-col min-w-0">
        <span className="text-[12px] font-medium" style={{ color }}>{label}</span>
        <span className="text-[10.5px] text-[var(--text-muted)] truncate">{detail}</span>
      </span>
    </>
  );
}

/** `rail` is the sidebar's version: an icon over a label, opening beside the sidebar. */
export default function MoreMenu({ compact = false, rail = false, onOpenMarkets }: { compact?: boolean; rail?: boolean; onOpenMarkets: () => void }) {
  const [open, setOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useDismiss(open, () => setOpen(false), rootRef, buttonRef);

  return (
    <div ref={rootRef} className={`relative pointer-events-auto ${rail ? 'w-full' : compact ? '' : 'ml-3'}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title="Markets, the token chart, support the project"
        className={rail ? `${RAIL_TRIGGER} ${open ? 'bg-white/[0.06] text-[var(--text-primary)]' : ''}` : `${MENU_TRIGGER} ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
      >
        {rail ? (
          <>
            <Ellipsis className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden />
            <span className="text-[10.5px] leading-none">More</span>
          </>
        ) : (
          <>
            <span className="text-[var(--gold-primary)] font-bold">MORE</span>
            <ChevronDown
              className={`w-2.5 h-2.5 text-[var(--gold-primary)] transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </>
        )}
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
            className={rail ? MENU_PANEL_SIDE : MENU_PANEL}
          >
            <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { setOpen(false); onOpenMarkets(); }}>
              <ItemBody Icon={BarChart3} label="Markets" detail="Prices, indices, the DonBot token analyzer (M)" color="var(--gold-primary)" />
            </button>
            <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { setOpen(false); setTokenOpen(true); }}>
              <ItemBody Icon={TrendingUp} label="$TAKIP chart" detail="Live token chart on Dexscreener" color="#14F195" />
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
                className={MENU_ITEM}
              >
                <ItemBody Icon={Icon} label={label} detail={detail} color={color} />
              </a>
            ))}
            <div className="px-2.5 pt-2 pb-1 text-[10px] font-mono text-[var(--text-muted)]">{APP_VERSION}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <TokenChart open={tokenOpen} onClose={() => setTokenOpen(false)} />
    </div>
  );
}
