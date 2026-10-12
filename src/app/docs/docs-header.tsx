'use client';

import type { Dispatch, SetStateAction } from 'react';
import Link from 'next/link';

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
          <svg
            viewBox="0 0 650 500"
            className="w-6 h-6 text-[var(--gold-primary)] transition-all group-hover:drop-shadow-[0_0_10px_rgba(212,175,55,0.6)]"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M158.66,157a70.231,70.231,0,0,0-14.44,42.81,70.235,70.235,0,1,0,140.47,0,70.231,70.231,0,0,0-14.28-42.81h-111.75z" />
            <path d="m140.86,465.53c-6.7333,0-8.7137-5.4462-12.181-25.899-2.4479-14.774-7.1068-28.463-10.502-43.043-3.0219-13.117-5.6425-20.332-9.6694-26.618-6.5526-10.229-6.3011-20.921,0.71691-30.481,6.33-8.6232,6.827-11.121,6.5471-32.901-0.13783-10.725-0.56403-21.286-0.94711-23.468-0.88077-5.0179-4.6148-7.6923-13.904-9.9586-8.4827-2.0695-16.525-2.2933-41.967-1.1681-18.144,0.80245-20.457,0.72323-22.75-0.77901-5.627-3.687-2.9527-8.8405,12.261-23.626,15.69-15.249,23.876-24.688,38.811-44.75,26.839-36.053,30.927-40.83,57.501-49.189,19.575-6.1582,26.691-9.0119,62.031-10.06,24.654-0.7309,38.767,2.5963,45.357,3.3466,25.219,2.8716,66.247,14.877,91.933,26.083,13.581,5.9249,14.042,6.1723,30.115,16.152,11.981,7.4391,18.733,10.459,35.44,15.034,34.886,9.553,56.753,7.7583,92,10.378,9.2579,0.68808,49.298,3.5149,74.5,4.4784,30.689,1.1732,35.835-2.0376,38.423,0.54994,2.0315,2.0315,0.5636,8.1815,0.6024,14.306,0.0237,3.7378-0.18399,7.6642-0.48569,11.602-8.1923-1.424-8.0353-1.3676-26.54-2.9165-1.6808-0.14069-16.718-1.6695-44.5-4.1726-11.867-1.0692-70.326-2.8448-105.5-3.9248-16.997-0.52189-34.357-4.7228-51-1.2347-5.7624,1.2076,2.387-1.1161-16,7.4812-36.313,14.051-55.853,23.79-104.5,32.83-30.774,4.5201-33.208,4.9745-36.376,7.2909-1.7456,1.2764-1.662,1.6171,1.6767,6.8363,3.5642,5.5717,14.275,15.81,29.699,28.389,51.619,43.564,115.05,77.431,162.89,98.598,22.221,9.5122,37.55,14.655,50.108,16.811,61.892,13.654,134.26-9.4938,136.11-56.959,0.0489-1.256,0.49928-6.001-0.1398-12.079-0.44539-4.2357-0.89625-7.3216-2.2932-11.095-3.9795-10.75-12.413-20.407-28.672-21.755-11.746,0.022-20.375,6.1561-23.95,16.17-4.5622,12.78,1.3185,27.071,14.023,29.565,6.6403,1.3038,11.222-0.5256,14.271-4.4679,3.3424-4.3221,3.72-12.026,1.3559-15.634-2.2757-3.4732-7.2459-5.2754-10.824-3.9248-3.6125,1.3636-4.9933,0.36555-0.6538-3.1839,0.38036-0.24867,0.77844-0.4586,1.191-0.63136,6.6675-2.7918,17.127,4.1226,17.913,14.135,0.7119,11.495-7.7045,20.279-19.249,20.94-6.5659,0.37574-14.594-1.9665-20.026-7.8035-13.425-14.428-9.1712-34.885,2.9586-45.762,4.6131-4.1366,7.7535-6.0583,14.065-7.4773,19.37-4.3554,37.69,4.5134,45.528,24.301,3.5645,8.9992,3.7675,16.201,3.8515,23.221,0.70438,58.895-65.742,87.202-131.95,82.517-28.009-2.4123-46.229-6.8095-80.495-20.915-36.58-12.09-143.44-68.32-207.96-120.33-18.846-15.317-30.511-22.813-33.055-21.24-0.61585,0.38062-0.98989,11.992-0.99221,30.802-0.004,28.758-0.1019,30.352-2.0717,33.583-3.2793,5.3791-4.935,17.725-5.9822,44.608-1.6327,41.914-2.675,60.915-3.4439,62.778-1.3963,3.383-7.0306,4.6642-13.289,4.6642z" />
          </svg>
          <span className="flex flex-col leading-none">
            <span className="text-[12px] font-bold tracking-[0.3em] text-[var(--gold-primary)] font-mono">
              OSIRIS
            </span>
            <span className="text-[9px] font-mono tracking-[0.22em] text-[var(--text-muted)] uppercase mt-[3px]">
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
          href="https://github.com/simplifaisoul/osiris"
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
