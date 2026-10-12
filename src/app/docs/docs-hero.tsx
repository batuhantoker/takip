'use client';

import { ENDPOINT_COUNT } from './apiCatalog';

export function DocsHero() {
  return (
    <div className="mb-20">
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--cyan-primary)]/20 bg-[var(--cyan-primary)]/[0.05] mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--alert-green)] animate-pulse" />
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-secondary)]">
          Open Source · MIT
        </span>
      </div>

      <h1 className="text-[38px] md:text-[52px] leading-[1.05] font-bold tracking-[-0.02em] mb-5">
        <span className="text-[var(--text-heading)]">Build on the</span>
        <br />
        <span className="bg-gradient-to-r from-[var(--gold-primary)] via-[#F0D060] to-[var(--cyan-primary)] bg-clip-text text-transparent">
          OSIRIS platform
        </span>
      </h1>

      <p className="text-[15px] leading-[1.75] text-[var(--text-secondary)] max-w-[42rem]">
        OSIRIS aggregates aviation, maritime, seismic, conflict, cyber, and OSINT feeds onto a single
        GPU-rendered map — and exposes every one of them as a plain HTTP endpoint. This is the same API the
        dashboard runs on. There is no separate, privileged internal tier.
      </p>

      <div className="flex flex-wrap gap-3 mt-8">
        <a
          href="#quickstart"
          className="inline-flex items-center gap-2 px-4 h-10 rounded-lg text-[11px] font-mono tracking-wider uppercase border border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/20 transition-colors"
        >
          Quick Start
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
        <a
          href="#api"
          className="inline-flex items-center gap-2 px-4 h-10 rounded-lg text-[11px] font-mono tracking-wider uppercase border border-white/[0.1] bg-white/[0.02] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-white/20 transition-colors"
        >
          API Reference
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-10">
        {[
          { n: String(ENDPOINT_COUNT), l: 'Endpoints' },
          { n: '20+', l: 'Live feeds' },
          { n: '0', l: 'Keys required' },
        ].map(s => (
          <div key={s.l} className="rounded-xl border border-white/[0.07] bg-white/[0.015] px-4 py-3">
            <div className="text-[24px] font-bold text-[var(--gold-primary)] font-mono leading-none">{s.n}</div>
            <div className="text-[11px] font-mono tracking-[0.15em] uppercase text-[var(--text-muted)] mt-1.5">
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
