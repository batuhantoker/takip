'use client';

import type { Dispatch, SetStateAction } from 'react';
import Link from 'next/link';
import { TakipMark } from '@/components/brand/takip-mark';
import { TakipWordmark } from '@/components/brand/takip-wordmark';

export function DocsHeader({
  navOpen,
  setNavOpen,
  setPaletteOpen,
  progress,
}: {
  navOpen: boolean;
  setNavOpen: Dispatch<SetStateAction<boolean>>;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  progress: number;
}) {
  return (
    <header className="sticky top-0 z-[300] border-b border-white/[0.06] bg-[var(--bg-void)]/85 backdrop-blur-xl">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <TakipMark className="h-6 w-auto text-[var(--brand-ink)] transition-[filter] group-hover:drop-shadow-[0_0_10px_rgba(47,128,255,0.5)]" />
          <span className="flex flex-col leading-none">
            <TakipWordmark className="h-[10px] w-auto text-[var(--brand-ink)]" />
            <span className="text-[9px] font-mono tracking-[0.22em] text-[var(--text-muted)] uppercase mt-[5px]">
              Docs
            </span>
          </span>
        </Link>

        <div className="flex-1" />

        {/* Palette trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="group flex items-center gap-2 px-3 h-8 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:border-[var(--gold-primary)]/30 hover:bg-white/[0.04] transition-colors"
          aria-label="Search documentation"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--gold-primary)] transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="hidden sm:inline text-[11.5px] text-[var(--text-muted)] font-mono">Search</span>
          <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-[var(--text-muted)]">
            ⌘K
          </kbd>
        </button>

        <a
          href="https://github.com/batuhantoker/takip"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-white/20 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
          </svg>
        </a>

        <Link
          href="/"
          className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.15em] uppercase px-3 h-8 rounded-lg border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/[0.08] text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/[0.18] transition-colors"
        >
          Launch Map
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>

        <button
          onClick={() => setNavOpen(v => !v)}
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-[var(--text-muted)] hover:text-[var(--gold-primary)]"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {navOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {/* Reading progress */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--cyan-primary)] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  );
}
