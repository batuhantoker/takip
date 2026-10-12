'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Suggestion } from '@/lib/markets';
import { T } from '@/lib/markets-terminal';

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
    <form onSubmit={e => { e.preventDefault(); run(pick >= 0 ? suggestions[pick] : undefined); }} className="relative flex gap-1.5">
      <div className="flex-1 relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold" style={{ color: T.accent }} aria-hidden="true">&gt;</span>
        <input
          value={command}
          onChange={e => { setCommand(e.target.value); setPick(-1); setMiss(null); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' && suggestions.length) { e.preventDefault(); setPick(p => (p + 1) % suggestions.length); }
            else if (e.key === 'ArrowUp' && suggestions.length) { e.preventDefault(); setPick(p => (p <= 0 ? suggestions.length - 1 : p - 1)); }
            else if (e.key === 'Escape' && command) { e.preventDefault(); setCommand(''); setPick(-1); }
          }}
          placeholder={miss ? `No match for ${miss}` : 'Ticker or function · LMT · gold · FX · help'}
          aria-label="Markets command: a ticker or function code"
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          className={`w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg pl-6 pr-2 py-1.5 text-[11px] font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors ${
            miss ? 'placeholder:text-[var(--alert-red)]' : 'placeholder:text-[var(--text-muted)]'
          }`}
          style={{ caretColor: T.accent }}
        />
      </div>
      <button
        type="submit"
        className="px-3 rounded-lg text-[10px] font-mono font-bold tracking-wider border border-[var(--border-active)] bg-[var(--hover-accent)] text-[var(--gold-primary)] hover:bg-[rgba(var(--gold-rgb),0.16)] transition-colors"
      >
        GO
      </button>
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-panel-solid)] shadow-xl overflow-hidden text-[10px] font-mono" role="listbox">
          {suggestions.map((s, i) => (
            <li key={`${s.kind}:${s.value}`} role="option" aria-selected={i === pick}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); run(s); }}
                onMouseEnter={() => setPick(i)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
                style={{ background: i === pick ? 'var(--hover-accent)' : undefined }}
              >
                <span className="w-14 shrink-0 font-bold truncate" style={{ color: s.kind === 'function' ? T.accent : T.text }}>{s.kind === 'function' ? s.label : s.hint}</span>
                <span className="truncate" style={{ color: T.dim }}>{s.kind === 'function' ? s.hint : s.label}</span>
                <span className="ml-auto text-[8px] tracking-widest" style={{ color: T.faint }}>{s.kind === 'function' ? 'FUNCTION' : 'SECURITY'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
