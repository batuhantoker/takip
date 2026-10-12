'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CountryView } from '@/lib/history/country-view';
import type { CatalogueMetric } from '@/lib/history/series';

const MAX_MATCHES = 40;

/** Search over every mappable country metric (WDI, OWID…), by name or code. */
export default function IndicatorSearch({ view, onDone }: { view: CountryView; onDone: () => void }) {
  const [metrics, setMetrics] = useState<CatalogueMetric[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    view.catalogue().then(setMetrics, () => setFailed(true));
  }, [view]);
  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!metrics || !words.length) return [];
    return metrics.filter(m => words.every(w => m.name.toLowerCase().includes(w) || m.code.toLowerCase().includes(w))).slice(0, MAX_MATCHES);
  }, [metrics, q]);

  return (
    <div>
      <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder={metrics ? `Search ${metrics.length.toLocaleString('en')} indicators` : 'Loading indicators…'}
        aria-label="Search indicators" onKeyDown={e => { if (e.key === 'Escape') onDone(); }}
        className="w-full h-8 px-2.5 rounded-md bg-black/40 border border-white/10 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold-primary)]/50" />
      {failed && <p className="mt-1.5 text-[11px] text-[var(--alert-red)]">Couldn&apos;t load the indicator list.</p>}
      {matches.length > 0 && (
        <ul className="mt-1.5 max-h-56 overflow-y-auto styled-scrollbar">
          {matches.map(m => (
            <li key={m.code}>
              <button type="button" onClick={() => { view.select(m.code); onDone(); }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--hover-accent)] text-[12px] text-[var(--text-primary)]">
                {m.name}
                <span className="ml-1.5 font-mono text-[10px] text-[var(--text-muted)]">{m.subjects} countries</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
