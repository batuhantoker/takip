'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';

/** The frame for a sidebar panel that has no header of its own: title, a little context, close. */
export default function PanelCard({ title, icon: Icon, meta, onClose, children }: {
  title: string;
  icon: LucideIcon;
  meta?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="glass-panel h-full min-h-0 flex flex-col overflow-hidden">
      <header className="h-12 shrink-0 flex items-center gap-2.5 pl-4 pr-2 border-b border-white/[0.06]">
        <Icon className="w-4 h-4 text-[var(--cyan-primary)]" strokeWidth={1.75} />
        <h2 className="text-[13px] font-semibold text-[var(--text-heading)]">{title}</h2>
        {meta}
        <button type="button" onClick={onClose} title="Close" aria-label={`Close ${title.toLowerCase()}`}
          className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-white/[0.06] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40">
          <X className="w-4 h-4" />
        </button>
      </header>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </section>
  );
}
