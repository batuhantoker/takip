'use client';

import { motion } from 'framer-motion';
import { hudIn } from '@/lib/hud-motion';
import { TakipMark } from '@/components/brand/takip-mark';
import { TakipWordmark } from '@/components/brand/takip-wordmark';

export default function AppHeader({ revealed, isMobile }: { revealed: boolean; isMobile: boolean }) {
  return (
    <motion.div data-hud initial={{ opacity: 0, y: -20 }} animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }} transition={hudIn(0.15)} className={`absolute top-4 z-[200] pointer-events-none flex flex-col`} style={{ left: isMobile ? '24px' : '64px', right: '24px' }}>
      <div className="flex items-center gap-3 w-fit drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)]">
        <TakipMark className="h-8 md:h-10 w-auto shrink-0 text-[var(--brand-ink)]" />
        <div className="flex flex-col items-start gap-[5px]">
          <h1 className="leading-none text-[var(--brand-ink)]"><TakipWordmark className="h-[13px] md:h-[15px] w-auto" /></h1>
          <span className="text-[8px] md:text-[9px] font-semibold tracking-[0.26em] uppercase text-[var(--brand-accent)] leading-none">Spatiotemporal intelligence</span>
        </div>
      </div>
    </motion.div>
  );
}
