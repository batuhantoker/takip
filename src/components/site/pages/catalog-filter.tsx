'use client';

import { useState, type KeyboardEvent } from 'react';
import { SearchField } from '@/components/ui/search-field';
import { useT } from '@/components/ui/use-t';

/** Lower case without accents, so "turkiye" finds "Türkiye". */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
const wordsOf = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Hides what `words` leave out of the page's catalog, and says how many items are left. */
function narrow(words: string[]): number {
  const root = document.querySelector('[data-catalog]');
  if (!root) return 0;
  let n = 0;
  for (const el of root.querySelectorAll<HTMLElement>('[data-catalog-item]')) {
    // From a word's start, so "war" finds warships but not software.
    const text = wordsOf(el.dataset.catalogItem ?? '');
    el.hidden = !words.every(w => text.some(x => x.startsWith(w)));
    if (!el.hidden) n++;
  }
  for (const box of root.querySelectorAll<HTMLElement>('[data-catalog-group], [data-catalog-section]')) {
    box.hidden = !box.querySelector('[data-catalog-item]:not([hidden])');
  }
  return n;
}

/**
 * Narrows the `[data-catalog]` list on the page as the reader types: every word has to be in an item's
 * `data-catalog-item` text, and groups and sections with nothing left are hidden with it. Enter opens the first match.
 * The rows stay in the server's HTML; this only hides them.
 */
export function CatalogFilter({ total, className }: { total: number; className?: string }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(total);
  const typed = query.trim();

  const change = (value: string) => {
    setQuery(value);
    setFound(narrow(wordsOf(value)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !typed) return;
    e.preventDefault();
    document.querySelector<HTMLAnchorElement>('[data-catalog] [data-catalog-item]:not([hidden]) a')?.click();
  };

  return (
    <div className={className}>
      <SearchField value={query} onChange={change} onKeyDown={onKeyDown} label={t('Find a layer')}
        placeholder={t('Ships, quakes, wars, cameras…')} autoComplete="off" spellCheck={false} />
      <p aria-live="polite" className="mt-2 text-[13px] text-ink-3">
        {!typed ? t('All {n} layers, by section.', { n: total })
          : found ? t('{n, plural, one {# layer matches} other {# layers match}}', { n: found })
            : t('No layer matches “{query}”.', { query: typed })}
      </p>
    </div>
  );
}
