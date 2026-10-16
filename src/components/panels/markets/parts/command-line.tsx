'use client';

import type { Dispatch, SetStateAction } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { fieldBox, fieldInput } from '@/components/ui/field-shell';
import { Kbd } from '@/components/ui/kbd';
import type { FunctionCode, Suggestion } from '@/lib/intel/markets/markets';
import { sectionTitle } from '@/components/panels/markets/markets-format';

/** Find a security or jump to a section: a ticker, a name, a section code or its number. */
export default function CommandLine({ command, setCommand, pick, setPick, miss, setMiss, suggestions, run }: {
  command: string;
  setCommand: (command: string) => void;
  pick: number;
  setPick: Dispatch<SetStateAction<number>>;
  miss: string | null;
  setMiss: (miss: string | null) => void;
  suggestions: Suggestion[];
  run: (s?: Suggestion) => void;
}) {
  return (
    <form onSubmit={e => { e.preventDefault(); run(pick >= 0 ? suggestions[pick] : undefined); }} className="relative">
      <div className={fieldBox('md', !!miss)}>
        <Search aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
        <input
          value={command}
          onChange={e => { setCommand(e.target.value); setPick(-1); setMiss(null); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' && suggestions.length) { e.preventDefault(); setPick(p => (p + 1) % suggestions.length); }
            else if (e.key === 'ArrowUp' && suggestions.length) { e.preventDefault(); setPick(p => (p <= 0 ? suggestions.length - 1 : p - 1)); }
            else if (e.key === 'Escape' && command) { e.preventDefault(); setCommand(''); setPick(-1); }
          }}
          placeholder="Ticker, name or section: LMT, gold, FX"
          aria-label="Find a security or section"
          aria-autocomplete="list"
          aria-describedby={miss ? 'markets-find-miss' : undefined}
          autoComplete="off"
          spellCheck={false}
          className={fieldInput}
        />
        {command && <Kbd size="sm"><CornerDownLeft aria-label="Enter" className="size-3" strokeWidth={2} /></Kbd>}
      </div>
      {miss && <p id="markets-find-miss" className="mt-1.5 text-meta text-red">Nothing matches “{miss}”. Type help for what works.</p>}
      {suggestions.length > 0 && (
        <ul role="listbox" className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-float border border-line bg-surface-1 p-1 shadow-float">
          {suggestions.map((s, i) => (
            <li key={`${s.kind}:${s.value}`} role="option" aria-selected={i === pick}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); run(s); }}
                onMouseEnter={() => setPick(i)}
                className={cx('flex h-8 w-full items-center gap-2.5 rounded-control px-2 text-left text-body', i === pick ? 'bg-surface-3' : '')}
              >
                <span className="w-16 shrink-0 truncate font-mono text-small text-ink-1">{s.kind === 'function' ? s.label : s.hint}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{s.kind === 'function' ? sectionTitle(s.value as FunctionCode) : s.label}</span>
                <span className="shrink-0 text-meta text-ink-3">{s.kind === 'function' ? 'Section' : 'Security'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
