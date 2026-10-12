'use client';

import type { OiHover } from '@/lib/oi/globe';

export default function OiHoverCard({ oiHover }: { oiHover: OiHover }) {
  return (
    <div
      className="fixed z-[950] pointer-events-none max-w-[300px] rounded-lg border border-[var(--border-primary)] bg-[rgba(12,14,26,0.94)] backdrop-blur-xl px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
      style={{ left: Math.min(oiHover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1920) - 314), top: oiHover.y + 16 }}
    >
      <div className="text-[11.5px] font-medium leading-snug text-[var(--text-heading)]">{oiHover.title}</div>
      {oiHover.detail && <div className="mt-0.5 text-[10.5px] leading-snug text-[var(--text-secondary)]">{oiHover.detail}</div>}
      <div className="mt-1 text-[8.5px] font-mono tracking-[0.18em] text-[var(--gold-primary)]">CLICK TO OPEN</div>
    </div>
  );
}
