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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm max-h-[90vh] flex flex-col bg-[#0A0A0A] border border-[var(--border-primary)] shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)]">
          <h2 id={titleId} className="text-sm text-[var(--text-primary)] truncate">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="overflow-y-auto styled-scrollbar flex flex-col gap-3 p-4">{children}</div>
      </div>
    </motion.div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{children}</p>;
}
