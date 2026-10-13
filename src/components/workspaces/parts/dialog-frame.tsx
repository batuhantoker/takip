'use client';

import { useId, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useDismiss } from '@/components/ui/use-dismiss';

/** A modal in the account dialog's style. */
export default function DialogFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDismiss(true, onClose, panelRef);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-auto px-4"
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm max-h-[90vh] flex flex-col rounded-float bg-surface-1 border border-line shadow-float"
      >
        <div className="flex h-[52px] items-center justify-between pl-4 pr-2 border-b border-line">
          <h2 id={titleId} className="text-[15px] font-semibold text-ink-1 truncate">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto styled-scrollbar flex flex-col gap-3 p-4">{children}</div>
      </div>
    </motion.div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-ink-2">{children}</p>;
}
