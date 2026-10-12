'use client';

import { Search } from 'lucide-react';

/** The closed state of Search: a field-shaped button in the top bar. */
export default function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      data-search-toggle
      onClick={onOpen}
      title="Search places, addresses or coordinates (S, or Ctrl/⌘ K)"
      className="pointer-events-auto glass-panel tool-glass h-9 w-full flex items-center gap-2.5 px-3 text-left text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
    >
      <Search className="w-3.5 h-3.5 shrink-0 text-[var(--gold-primary)]" aria-hidden />
      <span className="flex-1 truncate">Search places, addresses, coordinates</span>
      <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-[var(--gold-primary)] bg-[var(--bg-void)] border border-[var(--border-primary)]">S</kbd>
    </button>
  );
}
