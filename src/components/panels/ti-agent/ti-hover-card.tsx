'use client';

import type { OiHover } from '@/lib/oi/globe';

const W = 300;

/** What a TI mark on the globe is, under the pointer. */
export default function OiHoverCard({ oiHover }: { oiHover: OiHover }) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  return (
    <div className="pointer-events-none fixed z-[950] rounded-float border border-line bg-surface-1 px-3 py-2 shadow-float"
      style={{ maxWidth: W, left: Math.min(oiHover.x + 14, vw - W - 14), top: oiHover.y + 16 }}>
      <div className="text-small font-medium text-ink-1">{oiHover.title}</div>
      {oiHover.detail && <div className="mt-0.5 text-meta text-ink-2">{oiHover.detail}</div>}
      <div className="mt-1 text-meta text-ink-3">Click to open</div>
    </div>
  );
}
