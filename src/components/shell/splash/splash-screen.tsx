'use client';

import { useRef, type Dispatch, type SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TakipMark } from '@/components/shell/brand/takip-mark';
import { TakipWordmark } from '@/components/shell/brand/takip-wordmark';
import { GlobeCanvas } from './globe-canvas';
import { useGlobeHandoff } from './use-globe-handoff';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
/* Stages 0–2 are timed; 3 means the map has drawn its first frame. */
const PROGRESS = [0.15, 0.45, 0.75, 1];

/** The globe, the name, and one thin line filling as the map gets ready; then the globe hands over to the real one. */
export default function SplashScreen({ showSplash, splashStage, setSplashGone }: {
  showSplash: boolean;
  splashStage: number;
  setSplashGone: Dispatch<SetStateAction<boolean>>;
}) {
  const still = usePrefersReducedMotion();
  const globeRef = useRef<HTMLDivElement>(null);
  const handoff = useGlobeHandoff(globeRef);
  const quickFade = { opacity: 0, transition: { duration: 0.15 } };
  const progress = PROGRESS[Math.min(Math.max(splashStage, 0), PROGRESS.length - 1)];

  return (
    <AnimatePresence onExitComplete={() => setSplashGone(true)}>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: still ? 0.2 : 0.35, ease: EASE_OUT }}
          className="absolute inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden bg-surface-0"
        >
          {/* On exit the globe glides onto the map's opening globe, which faces the same way, and fades into it. */}
          <motion.div
            ref={globeRef}
            className="relative aspect-[1.15] w-full max-w-[560px] md:aspect-[1.45] md:w-[min(92vw,calc(62vh*1.45))] md:max-w-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={still ? undefined : { ...handoff, transition: { duration: 0.55, ease: EASE_IN_OUT } }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            <GlobeCanvas stage={splashStage} still={still} className="absolute inset-0 h-full w-full" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: still ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={quickFade}
            transition={{ delay: 0.15, duration: 0.4, ease: EASE_OUT }}
            className="z-[2] -mt-1 flex flex-col items-center gap-6"
          >
            <div className="flex items-center gap-3 text-ink-1">
              {/* Keyed: the preference can resolve after hydration, and an intro cut short would leave the mark hidden. */}
              <TakipMark key={still ? 'still' : 'intro'} intro={!still} className="h-9 w-auto md:h-10" />
              <TakipWordmark className="h-[22px] w-auto md:h-[26px]" />
            </div>
            <div role="progressbar" aria-label="Loading the map" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
              className="h-px w-40 overflow-hidden bg-line">
              <div className="h-full origin-left bg-ink-2 transition-transform duration-500 ease-out motion-reduce:transition-none"
                style={{ transform: `scaleX(${progress})` }} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
