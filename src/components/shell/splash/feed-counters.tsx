'use client';

import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';

export interface SplashFeed {
  label: string;
  count: number;
}

function Count({ value, still }: { value: number; still: boolean }) {
  const shown = useMotionValue(0);
  const text = useTransform(shown, v => Math.round(v).toLocaleString('en-US'));
  useEffect(() => {
    const run = animate(shown, value, { duration: still ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] });
    return () => run.stop();
  }, [shown, value, still]);
  return <motion.span className="font-mono tabular-nums text-[var(--brand-ink)]/90">{text}</motion.span>;
}

/** Live feed totals as they arrive; a feed shows once it has reported something. */
export function FeedCounters({ feeds, still }: { feeds: SplashFeed[]; still: boolean }) {
  const live = feeds.filter(f => f.count > 0);
  return (
    <ul className="flex min-h-5 max-w-[92vw] flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px]">
      {live.map(f => (
        <motion.li
          key={f.label}
          initial={{ opacity: 0, y: still ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-baseline gap-1.5"
        >
          <span className="text-[var(--brand-ink)]/45">{f.label}</span>
          <Count value={f.count} still={still} />
        </motion.li>
      ))}
    </ul>
  );
}
