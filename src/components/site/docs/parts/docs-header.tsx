'use client';

import type { Dispatch, SetStateAction } from 'react';
import Link from 'next/link';
import { TakipMark } from '@/components/shell/brand/takip-mark';
import { TakipWordmark } from '@/components/shell/brand/takip-wordmark';
import { useT } from '@/components/ui/use-t';

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
  const t = useT();
  return (
    <header className="sticky top-0 z-[300] border-b border-line bg-surface-0">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <TakipMark className="h-6 w-auto text-[var(--brand-ink)]" />
          <span className="flex flex-col leading-none">
            <TakipWordmark className="h-[10px] w-auto text-[var(--brand-ink)]" />
            <span className="text-[11px] font-medium text-ink-3 mt-[3px]">{t('Docs')}</span>
          </span>
        </Link>

        <div className="flex-1" />

        {/* Palette trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="group flex items-center gap-2 px-3 h-8 rounded-md border border-line-strong bg-surface-1 hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={t('Search documentation')}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-ink-3 group-hover:text-ink-1 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="hidden sm:inline text-[13px] text-ink-3">{t('Search the docs')}</span>
          <kbd className="hidden sm:inline text-[11px] font-mono px-1.5 py-0.5 rounded-[4px] border border-line-strong bg-surface-2 text-ink-2">
            ⌘K
          </kbd>
        </button>

        <a
          href="https://github.com/batuhantoker/takip"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('GitHub repository')}
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
          </svg>
        </a>

        <Link
          href="/"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-medium px-3 h-8 rounded-md bg-accent text-on-accent hover:bg-accent/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('Open the map')}
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>

        <button
          onClick={() => setNavOpen(v => !v)}
          aria-label={t('Toggle navigation')}
          aria-expanded={navOpen}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink-1"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {navOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {/* Reading progress */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-transparent">
        <div
          className="h-full bg-accent/60 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  );
}
