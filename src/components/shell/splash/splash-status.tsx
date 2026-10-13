'use client';

import { AnimatePresence, motion } from 'framer-motion';

/* Stages 0–2 are timed; 3 means the map has drawn its first frame. */
const STAGES = ['Starting up', 'Connecting to live feeds', 'Loading the globe', 'Ready'];
const PROGRESS = [0.12, 0.42, 0.74, 1];

export function SplashStatus({ stage, still }: { stage: number; still: boolean }) {
  const i = Math.min(Math.max(stage, 0), STAGES.length - 1);
  const ready = i === STAGES.length - 1;
  return (
    <div className="flex w-52 flex-col items-center gap-3 md:w-60">
      <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-[rgba(47,128,255,0.14)]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--brand-accent)] shadow-[0_0_10px_rgba(47,128,255,0.7)]"
          initial={{ width: '0%' }}
          animate={{ width: `${PROGRESS[i] * 100}%` }}
          transition={{ duration: still ? 0 : 0.6, ease: 'easeInOut' }}
        />
      </div>
      <div className="flex h-5 items-center gap-2 text-[13px] text-[var(--brand-ink)]/60" role="status">
        <span
          className={`h-1.5 w-1.5 rounded-full bg-[var(--brand-accent)] ${ready || still ? '' : 'animate-pulse'}`}
          style={{ boxShadow: ready ? '0 0 8px rgba(47,128,255,0.9)' : undefined }}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={i}
            initial={{ opacity: 0, y: still ? 0 : 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: still ? 0 : -3 }}
            transition={{ duration: 0.18 }}
            className={ready ? 'text-[var(--brand-ink)]' : undefined}
          >
            {STAGES[i]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
