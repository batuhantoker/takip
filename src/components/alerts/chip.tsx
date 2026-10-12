'use client';

import type { ReactNode } from 'react';

export default function Chip({ children, color = '#8A8880', title }: { children: ReactNode; color?: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded px-1 py-[1px] text-[8.5px] font-mono uppercase tracking-wider"
      style={{ color, background: `${color}14`, border: `1px solid ${color}26` }}
    >
      {children}
    </span>
  );
}
