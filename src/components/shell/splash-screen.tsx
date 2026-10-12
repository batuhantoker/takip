'use client';

import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_VERSION } from '@/lib/app-version';
import { TakipMark } from '@/components/brand/takip-mark';
import { TakipWordmark } from '@/components/brand/takip-wordmark';

/* The splash reports what has actually happened. The last stage waits for
   the map's first finished frame instead of a fixed timer. */
const SPLASH_STAGES = ['ESTABLISHING SECURE CONNECTION...', 'INITIALIZING FEEDS...', 'CALIBRATING SENSORS...', 'SYSTEM READY'];
const SPLASH_PROGRESS = ['25%', '50%', '78%', '100%'];

export default function SplashScreen({ showSplash, splashStage, setSplashGone }: {
  showSplash: boolean;
  splashStage: number;
  setSplashGone: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <AnimatePresence onExitComplete={() => setSplashGone(true)}>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          // A slight push-through as it fades: the splash gives way to the globe
          // behind it instead of just dissolving.
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at center, #0c1220 0%, var(--bg-void) 70%)' }}
        >
          {/* ── Version badge — top-left ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="absolute top-6 left-6 z-[2] font-mono text-[11px] tracking-[0.3em] text-[var(--text-muted)]"
          >
            {APP_VERSION}
          </motion.div>

          <TakipMark intro className="relative w-52 md:w-60 h-auto mb-8 z-[2] text-[var(--brand-ink)]" />

          <motion.div
            initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
            className="mb-4 z-[2] text-[var(--brand-ink)]"
          >
            <TakipWordmark className="h-9 md:h-11 w-auto" />
          </motion.div>

          {/* ── Subtitle — typewriter reveal ── */}
          <div className="overflow-hidden mb-10 z-[2]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: 1.2, duration: 0.8, ease: 'easeInOut' }}
              className="overflow-hidden whitespace-nowrap"
            >
              <p className="text-[11px] md:text-[12px] font-semibold tracking-[0.42em] text-[var(--brand-accent)]">
                SPATIOTEMPORAL INTELLIGENCE
              </p>
            </motion.div>
          </div>

          {/* ── Multi-stage progress bar ── */}
          <div className="w-64 md:w-80 z-[2]">
            <div className="relative w-full h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(47,128,255,0.12)' }}>
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: SPLASH_PROGRESS[splashStage] }}
                transition={{ duration: 0.55, delay: splashStage === 0 ? 0.5 : 0, ease: 'easeInOut' }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: 'var(--brand-accent)', boxShadow: '0 0 12px rgba(47,128,255,0.45)' }}
              />
            </div>

            {/* Status message — one line, swapped as each stage is reached */}
            <div className="mt-3 h-4 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={splashStage}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.18, delay: splashStage === 0 ? 0.5 : 0 }}
                  className="text-[10px] font-mono tracking-[0.25em]"
                  style={{ color: splashStage === 3 ? 'var(--brand-accent)' : 'var(--text-muted)' }}
                >
                  {SPLASH_STAGES[splashStage]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Faint graticule ── */}
          <div className="absolute inset-0 pointer-events-none z-[0]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
