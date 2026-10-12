'use client';

import { Search, X } from 'lucide-react';

export default function LayerSearchField({ query, setQuery, autoFocus, mobile }: {
  query: string; setQuery: (query: string) => void; autoFocus?: boolean; mobile?: boolean;
}) {
  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          // Esc clears first; the panel's window listener closes it once the field is empty.
          if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery(''); }
        }}
        autoFocus={autoFocus}
        placeholder="Search layers"
        aria-label="Search layers"
        autoComplete="off"
        spellCheck={false}
        // iOS zooms into inputs under 16px.
        className={`w-full rounded-md border border-white/10 bg-white/[0.03] pl-7 pr-7 text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 transition-colors ${mobile ? 'h-9 text-[16px]' : 'h-7 text-[11px]'}`}
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          aria-label="Clear layer search"
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
