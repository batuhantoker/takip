'use client';
/**
 * TAKIP TI: find any object in the run by name.
 *
 * Ctrl+K (or ⌘K, or /) from anywhere in the workspace. Arrow keys move,
 * Enter opens, Escape clears and then leaves. Results come from
 * lib/oi/objects, best match first, with each object's type and icon.
 */
import { forwardRef, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/ui/class-names';
import { SearchField } from '@/components/ui/search-field';
import { searchObjects, TYPE_LABEL } from '@/lib/oi/objects';
import type { RunState } from '@/lib/oi/state';
import { TypeIcon, accentFor } from '@/components/panels/ti-agent/atoms';

export interface ObjectSearchHandle { focus: () => void }

export const ObjectSearch = forwardRef<ObjectSearchHandle, { s: RunState; onPick: (key: string) => void }>(function ObjectSearch({ s, onPick }, ref) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const focus = () => { const el = box.current?.querySelector('input'); el?.focus(); el?.select(); };
  useImperativeHandle(ref, () => ({ focus }), []);

  const results = useMemo(() => searchObjects(s, query, 10), [s, query]);
  const pick = (key: string) => { onPick(key); setQuery(''); setOpen(false); box.current?.querySelector('input')?.blur(); };
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div ref={box} className="relative">
      <SearchField size="sm" value={query} placeholder="Find in this run" kbd={isMac ? '⌘K' : 'Ctrl K'}
        onChange={v => { setQuery(v); setCursor(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
          else if (e.key === 'Enter' && results[cursor]) { e.preventDefault(); pick(results[cursor].key); }
        }}
        role="combobox" aria-expanded={open && results.length > 0} aria-controls={`${id}-results`} aria-autocomplete="list" />
      {open && query.trim() && (
        <div id={`${id}-results`} role="listbox"
          className="styled-scrollbar absolute top-[calc(100%+6px)] right-0 z-50 max-h-[60vh] w-[340px] overflow-y-auto rounded-float border border-line bg-surface-1 p-1 shadow-float">
          {results.length === 0 && <p className="px-3 py-3 text-small text-ink-3">Nothing in this run matches “{query}”.</p>}
          {results.map((o, i) => (
            <button key={o.key} type="button" role="option" aria-selected={i === cursor} onMouseDown={e => { e.preventDefault(); pick(o.key); }} onMouseEnter={() => setCursor(i)}
              className={cx('flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left', i === cursor && 'bg-surface-2')}>
              <TypeIcon k={o.key} subtype={o.subtype} className={cx('size-4 shrink-0', accentFor(o.key))} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink-1">{o.title}</span>
                {o.subtitle && <span className="block truncate text-meta text-ink-3">{o.subtitle}</span>}
              </span>
              <span className="shrink-0 text-meta text-ink-3">{TYPE_LABEL[o.type]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
