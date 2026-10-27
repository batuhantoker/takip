'use client';

import { useEffect, useState } from 'react';

/** How long the full line shows before the splash lifts. */
export const SPLASH_HOLD_MS = 150;

/* The splash lifts once the map has drawn its first frame. It never lifts
   before the mark has started drawing (0.6 s), and never later than 6 s, so a
   machine that cannot start the map still reaches the platform. */
export function useSplash(mapReady: boolean) {
  const [showSplash, setShowSplash] = useState(true);
  const [timedStage, setTimedStage] = useState(0);
  /** True once the splash has finished fading out, not merely started to. */
  const [splashGone, setSplashGone] = useState(false);
  // Stage 3 means the map is ready.
  const splashStage = mapReady && timedStage >= 2 ? 3 : timedStage;

  useEffect(() => {
    const timers = [
      setTimeout(() => setTimedStage(s => Math.max(s, 1)), 300),
      setTimeout(() => setTimedStage(s => Math.max(s, 2)), 600),
      setTimeout(() => setShowSplash(false), 6000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (splashStage !== 3) return;
    const t = setTimeout(() => setShowSplash(false), SPLASH_HOLD_MS);
    return () => clearTimeout(t);
  }, [splashStage]);

  return { showSplash, splashStage, splashGone, setSplashGone, revealed: !showSplash };
}
