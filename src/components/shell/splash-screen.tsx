'use client';

import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_VERSION } from '@/lib/app-version';

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
          style={{ background: 'radial-gradient(ellipse at center, #0a0a14 0%, var(--bg-void) 70%)' }}
        >
          {/* ── Scanline CRT overlay ── */}
          <div className="absolute inset-0 pointer-events-none z-[1]" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(212,175,55,0.015) 2px, rgba(212,175,55,0.015) 4px)',
            animation: 'splashScanDrift 8s linear infinite',
          }} />

          {/* ── Version badge — top-left ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="absolute top-6 left-6 z-[2] font-mono text-[11px] tracking-[0.3em] text-[var(--gold-primary)]"
          >
            {APP_VERSION}
          </motion.div>



          {/* ── Geometric tactical logo ── */}
          <div className="relative w-40 h-40 mb-8 flex items-center justify-center z-[2]">
            {/* Outer ring — slow clockwise */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: 360 }}
              transition={{ opacity: { duration: 0.6 }, scale: { duration: 0.8, ease: 'easeOut' }, rotate: { duration: 20, repeat: Infinity, ease: 'linear' } }}
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid rgba(212,175,55,0.2)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: 'var(--gold-primary)', boxShadow: '0 0 12px var(--gold-primary), 0 0 24px rgba(212,175,55,0.3)' }} />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full" style={{ background: 'rgba(212,175,55,0.5)', boxShadow: '0 0 6px rgba(212,175,55,0.3)' }} />
            </motion.div>

            {/* Middle ring — faster counter-clockwise */}
            <motion.div
              initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: -360 }}
              transition={{ opacity: { duration: 0.6, delay: 0.15 }, scale: { duration: 0.8, delay: 0.15, ease: 'easeOut' }, rotate: { duration: 12, repeat: Infinity, ease: 'linear' } }}
              className="absolute rounded-full"
              style={{ inset: '18px', border: '1px solid rgba(0,229,255,0.15)' }}
            >
              <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cyan-primary)', boxShadow: '0 0 10px var(--cyan-primary), 0 0 20px rgba(0,229,255,0.2)' }} />
              <div className="absolute bottom-0 left-1/4 translate-y-1/2 w-1 h-1 rounded-full" style={{ background: 'rgba(0,229,255,0.4)' }} />
            </motion.div>

            {/* Inner ring — fastest clockwise */}
            <motion.div
              initial={{ opacity: 0, scale: 0.2, rotate: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: 360 }}
              transition={{ opacity: { duration: 0.6, delay: 0.3 }, scale: { duration: 0.8, delay: 0.3, ease: 'easeOut' }, rotate: { duration: 7, repeat: Infinity, ease: 'linear' } }}
              className="absolute rounded-full"
              style={{ inset: '40px', border: '1px solid rgba(212,175,55,0.25)' }}
            >
              <div className="absolute top-0 left-1/4 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold-primary)', boxShadow: '0 0 8px var(--gold-primary)' }} />
            </motion.div>

            {/* Core circle + crosshair */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative w-12 h-12 rounded-full flex items-center justify-center"
              style={{ border: '2px solid var(--gold-primary)', boxShadow: '0 0 20px rgba(212,175,55,0.15), inset 0 0 20px rgba(212,175,55,0.05)' }}
            >
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-5 h-5 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, rgba(212,175,55,0.05) 70%)' }}
              />
              {/* Crosshair lines */}
              <div className="absolute w-[1px] h-full" style={{ background: 'linear-gradient(to bottom, transparent, rgba(212,175,55,0.3), transparent)' }} />
              <div className="absolute w-full h-[1px]" style={{ background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.3), transparent)' }} />
            </motion.div>

            {/* Faint pulsing radar sweep */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.15, 0], rotate: [0, 360] }}
              transition={{ opacity: { duration: 3, repeat: Infinity }, rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, delay: 0.6 }}
              className="absolute inset-[10px] rounded-full"
              style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(212,175,55,0.15) 40deg, transparent 80deg)' }}
            />
          </div>

          {/* ── TAKIP title — letter-by-letter stagger ── */}
          <div className="flex items-center gap-[2px] mb-3 z-[2]">
            {'TAKIP'.split('').map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
                className="text-4xl md:text-5xl font-bold tracking-[0.5em] font-mono"
                style={{ color: 'var(--text-heading)', textShadow: '0 0 30px rgba(212,175,55,0.2)' }}
              >
                {letter}
              </motion.span>
            ))}
          </div>

          {/* ── Subtitle — typewriter reveal ── */}
          <div className="overflow-hidden mb-8 z-[2]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: 1.2, duration: 0.8, ease: 'easeInOut' }}
              className="overflow-hidden whitespace-nowrap"
            >
              <p className="text-[11px] md:text-[10px] font-mono tracking-[0.5em] text-[var(--gold-primary)]" style={{ opacity: 0.8 }}>
                GLOBAL INTELLIGENCE PLATFORM
              </p>
            </motion.div>
          </div>

          {/* ── Multi-stage progress bar ── */}
          <div className="w-64 md:w-80 z-[2]">
            {/* Thin progress track */}
            <div className="relative w-full h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(212,175,55,0.1)' }}>
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: SPLASH_PROGRESS[splashStage] }}
                transition={{ duration: 0.55, delay: splashStage === 0 ? 0.5 : 0, ease: 'easeInOut' }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: 'linear-gradient(90deg, var(--gold-primary), var(--cyan-primary), var(--gold-primary))', boxShadow: '0 0 12px rgba(212,175,55,0.4)' }}
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
                  style={{ color: splashStage === 3 ? 'var(--cyan-primary)' : 'var(--text-muted)' }}
                >
                  {SPLASH_STAGES[splashStage]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Decorative grid lines ── */}
          <div className="absolute inset-0 pointer-events-none z-[0]" style={{ opacity: 0.03 }}>
            <div className="absolute inset-0" style={{
              backgroundImage: 'linear-gradient(rgba(212,175,55,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.5) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }} />
          </div>

          {/* ── Corner frame accents ── */}
          {[
            { t: '10px', l: '10px', bw: '2px 0 0 2px' },
            { t: '10px', r: '10px', bw: '2px 2px 0 0' },
            { b: '10px', l: '10px', bw: '0 0 2px 2px' },
            { b: '10px', r: '10px', bw: '0 2px 2px 0' },
          ].map((pos, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
              className="absolute w-8 h-8 z-[2]"
              style={{ top: pos.t, bottom: pos.b, left: pos.l, right: pos.r, borderWidth: pos.bw, borderStyle: 'solid', borderColor: 'var(--gold-primary)' }}
            />
          ))}



          {/* ── Inline keyframe for scanline drift ── */}

        </motion.div>
      )}
    </AnimatePresence>
  );
}
