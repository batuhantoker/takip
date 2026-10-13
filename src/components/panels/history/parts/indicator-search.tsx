'use client';

import { useEffect, useMemo, useState } from 'react';
import { SearchField } from '@/components/ui/field';
import { ListRow } from '@/components/ui/list-row';
import type { CountryView } from '@/lib/history/country-view';
import type { CatalogueMetric } from '@/lib/history/series';

const MAX_MATCHES = 40;

/** Search over every mappable country metric (WDI, OWID…), by name or code. Escape on an empty field gives up. */
export default function IndicatorSearch({ view, onDone }: { view: CountryView; onDone: () => void }) {
  const [metrics, setMetrics] = useState<CatalogueMetric[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    view.catalogue().then(setMetrics, () => setFailed(true));
  }, [view]);
  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!metrics || !words.length) return [];
    return metrics.filter(m => words.every(w => m.name.toLowerCase().includes(w) || m.code.toLowerCase().includes(w))).slice(0, MAX_MATCHES);
  }, [metrics, q]);

  return (
    <div>
      <SearchField value={q} onChange={setQ} autoFocus label="Search indicators"
        placeholder={metrics ? `Search ${metrics.length.toLocaleString('en')} indicators` : 'Loading indicators…'}
        onKeyDown={e => {
          if (e.key !== 'Escape' || q) return;
          e.preventDefault();
          onDone();
        }} />
      {failed && <p className="mt-2 text-meta text-red">Couldn&apos;t load the indicator list.</p>}
      {q.trim() && metrics && !matches.length && <p className="mt-2 text-small text-ink-3">No indicator matches “{q.trim()}”.</p>}
      {matches.length > 0 && (
        <div className="styled-scrollbar -mx-2 mt-2 max-h-64 overflow-y-auto">
          {matches.map(m => (
            // Long names differ only at the end ("… (% of GNI)"), so they wrap instead of truncating.
            <ListRow key={m.code} compact flush title={<span className="line-clamp-2 whitespace-normal">{m.name}</span>}
              trailing={<span className="text-meta text-ink-3"><span className="font-mono tabular-nums">{m.subjects.toLocaleString('en')}</span> countries</span>}
              onClick={() => { view.select(m.code); onDone(); }} />
          ))}
        </div>
      )}
    </div>
  );
}
