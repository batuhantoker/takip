'use client';

import { useRef, type Dispatch, type SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_VERSION } from '@/lib/app-version';
import { TakipMark } from '@/components/brand/takip-mark';
import { TakipWordmark } from '@/components/brand/takip-wordmark';
import { GlobeCanvas } from './splash/globe-canvas';
import { SplashStatus } from './splash/splash-status';
import { FeedCounters, type SplashFeed } from './splash/feed-counters';
import { useGlobeHandoff } from './splash/use-globe-handoff';
import { usePrefersReducedMotion } from './splash/use-prefers-reduced-motion';

export type { SplashFeed };

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export default function SplashScreen({ showSplash, splashStage, setSplashGone, feeds }: {
  showSplash: boolean;
  splashStage: number;
  setSplashGone: Dispatch<SetStateAction<boolean>>;
  /** Live feed totals, ticked up as they arrive. */
  feeds?: SplashFeed[];
}) {
  const still = usePrefersReducedMotion();
  const globeRef = useRef<HTMLDivElement>(null);
  const handoff = useGlobeHandoff(globeRef);
  const quickFade = { opacity: 0, transition: { duration: 0.25 } };

  return (
    <AnimatePresence onExitComplete={() => setSplashGone(true)}>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: still ? 0.4 : 0.6, delay: still ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at 50% 40%, #0b1426 0%, var(--bg-void) 62%)' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={quickFade}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="absolute top-6 left-6 z-[2] font-mono text-[11px] tracking-[0.2em] text-[var(--brand-ink)]"
          >
            {APP_VERSION}
          </motion.div>

          {/* On exit the globe glides onto the map's opening globe, which faces the same way, and fades into it. */}
          <motion.div
            ref={globeRef}
            className="relative aspect-[1.15] w-full max-w-[560px] md:aspect-[1.45] md:w-[min(92vw,calc(62vh*1.45))] md:max-w-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={still ? undefined : { ...handoff, transition: { duration: 0.65, ease: EASE_IN_OUT } }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          >
            <GlobeCanvas stage={splashStage} still={still} className="absolute inset-0 h-full w-full" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: still ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={quickFade}
            transition={{ delay: 0.3, duration: 0.6, ease: EASE_OUT }}
            className="z-[2] -mt-1 flex flex-col items-center"
          >
            <div className="flex items-center gap-3 text-[var(--brand-ink)]">
              {/* Keyed: the preference can resolve after hydration, and an intro cut short would leave the mark hidden. */}
              <TakipMark key={still ? 'still' : 'intro'} intro={!still} className="h-9 w-auto md:h-10" />
              <TakipWordmark className="h-[22px] w-auto md:h-[26px]" />
            </div>
            <p className="mt-2.5 text-[13px] tracking-wide text-[var(--brand-ink)]/45">Spatiotemporal intelligence</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={quickFade}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="z-[2] mt-8 flex flex-col items-center gap-4"
          >
            <SplashStatus stage={splashStage} still={still} />
            {feeds && feeds.length > 0 && <FeedCounters feeds={feeds} still={still} />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
