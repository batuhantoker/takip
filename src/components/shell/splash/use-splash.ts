'use client';

import { useEffect, useState } from 'react';

/* The splash lifts once the map has drawn its first frame. It never lifts
   before the mark has drawn (about 1 s), and never later than 6 s, so a
   machine that cannot start the map still reaches the platform. */
export function useSplash(mapReady: boolean) {
  const [showSplash, setShowSplash] = useState(true);
  const [splashStage, setSplashStage] = useState(0);
  /** True once the splash has finished fading out, not merely started to. */
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setSplashStage(s => Math.max(s, 1)), 400),
      setTimeout(() => setSplashStage(s => Math.max(s, 2)), 900),
      setTimeout(() => setShowSplash(false), 6000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (!mapReady || splashStage !== 2) return;
    const t = setTimeout(() => setSplashStage(3), 150);
    return () => clearTimeout(t);
  }, [mapReady, splashStage]);
  useEffect(() => {
    if (splashStage !== 3) return;
    // Long enough to see the line reach the end.
    const t = setTimeout(() => setShowSplash(false), 300);
    return () => clearTimeout(t);
  }, [splashStage]);

  return { showSplash, splashStage, splashGone, setSplashGone, revealed: !showSplash };
}
