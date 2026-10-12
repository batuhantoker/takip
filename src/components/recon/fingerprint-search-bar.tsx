'use client';

import { AtSign, Mail, Phone, Search, Square, ArrowRight, AlertTriangle } from 'lucide-react';
import type { SearchType } from '@/lib/fingerprint';
import { ACCENT } from '@/lib/recon-fingerprint';
import type { FingerprintState } from './use-fingerprint-search';

const MODES: { id: SearchType; label: string; icon: typeof AtSign; placeholder: string; covers: string }[] = [
  { id: 'username', label: 'Username', icon: AtSign, placeholder: 'Enter a username…', covers: 'Every public site in the Sherlock database, checked in parallel' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: 'Enter an email address…', covers: 'Known breach corpora and the address’s mail domain' },
  { id: 'phone', label: 'Phone', icon: Phone, placeholder: 'Enter a phone number (+1 …)', covers: 'Numbering plan: validity, region, format and line type' },
];

export function FingerprintSearchBar({ fp, running }: { fp: FingerprintState; running: boolean }) {
  const modeDef = MODES.find(m => m.id === fp.mode) ?? MODES[0];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-center">
        <div className="inline-flex p-0.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/60" role="tablist" aria-label="Search type">
          {MODES.map(m => {
            const active = fp.mode === m.id;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={active}
                disabled={running}
                onClick={() => { fp.setMode(m.id); fp.setError(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono font-bold tracking-wider transition-colors disabled:cursor-not-allowed"
                style={{ background: active ? ACCENT : 'transparent', color: active ? '#fff' : 'var(--text-muted)', opacity: running && !active ? 0.4 : 1 }}
              >
                <m.icon className="w-3 h-3" />
                {m.label.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={e => { e.preventDefault(); if (running) fp.stop(); else fp.run(fp.mode, fp.query); }}
        className="flex gap-1.5"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            value={fp.query}
            onChange={e => fp.setQuery(e.target.value)}
            placeholder={modeDef.placeholder}
            disabled={running}
            inputMode={fp.mode === 'phone' ? 'tel' : fp.mode === 'email' ? 'email' : 'text'}
            autoComplete="off"
            spellCheck={false}
            aria-label={modeDef.placeholder}
            className="w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg pl-8 pr-3 py-2.5 text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none transition-colors disabled:opacity-60"
            style={{ borderColor: fp.query ? `${ACCENT}66` : undefined }}
          />
        </div>
        <button
          type="submit"
          disabled={!running && !fp.query.trim()}
          className="px-3.5 py-2 rounded-lg text-[10px] font-mono font-bold tracking-wider disabled:opacity-30 transition-all flex items-center justify-center gap-1.5 min-w-[88px]"
          style={running
            ? { background: '#FF3D3D1f', border: '1px solid #FF3D3D55', color: '#FF3D3D' }
            : { background: ACCENT, border: `1px solid ${ACCENT}`, color: '#fff' }}
        >
          {running ? <><Square className="w-3 h-3" />STOP</> : <><ArrowRight className="w-3.5 h-3.5" />SEARCH</>}
        </button>
      </form>

      <div className="text-[9px] font-mono text-[var(--text-muted)] text-center leading-relaxed">
        Public sources only · {modeDef.covers.toLowerCase()}
      </div>

      {fp.error && (
        <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-[10px] font-mono text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{fp.error}
        </div>
      )}
    </div>
  );
}
