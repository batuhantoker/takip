'use client';

import { useT } from '@/components/ui/use-t';
import { FUNCTIONS } from '@/lib/intel/markets/markets';
import { sectionTitle } from '@/components/panels/markets/markets-format';

/** What the find field understands. */
export default function MarketsHelp() {
  const t = useT();
  return (
    <div className="text-small text-ink-2">
      <p className="text-body text-ink-1">{t('Type a ticker, a name or a section, then press Enter.')}</p>
      <ul className="mt-3">
        {FUNCTIONS.map(f => (
          <li key={f.code} className="flex min-h-8 items-baseline gap-3 border-b border-line py-1.5 last:border-b-0">
            <span className="w-16 shrink-0 font-mono text-ink-3 tabular-nums">{f.key} · {f.code}</span>
            <span className="min-w-0 flex-1 text-ink-1">{sectionTitle(f.code, t)}</span>
            <span className="truncate font-mono text-meta text-ink-3">{f.aliases.slice(0, 2).join(' · ')}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3">
        {t.rich('Securities by ticker or name: {examples}.', {
          examples: <><span className="font-mono text-ink-1">LMT</span>, <span className="text-ink-1">gold</span>, <span className="font-mono text-ink-1">EURUSD</span>, <span className="text-ink-1">nikkei</span></>,
        })}
        {' '}{t('Arrow keys pick a suggestion, Escape clears, the star adds a row to your watchlist, and a column heading sorts.')}
      </p>
    </div>
  );
}
