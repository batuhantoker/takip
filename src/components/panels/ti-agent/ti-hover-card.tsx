'use client';

import { useT } from '@/components/ui/use-t';
import type { AiHover } from '@/lib/ai/globe/attach';

const W = 300;

/** What a TI mark on the globe is, under the pointer. */
export default function AiHoverCard({ aiHover }: { aiHover: AiHover }) {
  const t = useT();
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  return (
    <div className="pointer-events-none fixed z-[950] rounded-float border border-line bg-surface-1 px-3 py-2 shadow-float"
      style={{ maxWidth: W, left: Math.min(aiHover.x + 14, vw - W - 14), top: aiHover.y + 16 }}>
      <div className="text-small font-medium text-ink-1">{aiHover.title}</div>
      {aiHover.detail && <div className="mt-0.5 text-meta text-ink-2">{aiHover.detail}</div>}
      <div className="mt-1 text-meta text-ink-3">{t('Click to open')}</div>
    </div>
  );
}
