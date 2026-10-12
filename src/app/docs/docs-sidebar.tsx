'use client';

import { ENDPOINT_COUNT } from './apiCatalog';
import { API_SECTIONS, GUIDE_SECTIONS } from './docs-sections';

export function DocsSidebar({
  active,
  navOpen,
  closeNav,
}: {
  active: string;
  navOpen: boolean;
  closeNav: () => void;
}) {
  const navLink = (s: { id: string; title: string }) => (
    <a
      key={s.id}
      href={`#${s.id}`}
      onClick={closeNav}
      className={`relative block pl-4 pr-3 py-[7px] text-[12.5px] rounded-r-md transition-all duration-200 ${
        active === s.id
          ? 'text-[var(--gold-primary)] bg-[var(--gold-primary)]/[0.07] font-medium'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]'
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full transition-all duration-200 ${
          active === s.id ? 'h-[70%] bg-[var(--gold-primary)]' : 'h-0 bg-transparent'
        }`}
      />
      {s.title}
    </a>
  );

  return (
    <nav
      className={`${
        navOpen
          ? 'translate-x-0 opacity-100'
          : '-translate-x-4 opacity-0 pointer-events-none lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto'
      } fixed lg:sticky top-14 left-0 bottom-0 lg:bottom-auto z-[260] lg:z-auto w-64 lg:w-56 shrink-0 lg:h-[calc(100vh-3.5rem)] overflow-y-auto styled-scrollbar bg-[var(--bg-void)] lg:bg-transparent border-r lg:border-r-0 border-white/[0.06] py-6 pr-2 pl-2 lg:pl-0 transition-all duration-200`}
    >
      <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--text-muted)]/70 pl-4 mb-2">
        Guide
      </div>
      {GUIDE_SECTIONS.map(navLink)}

      <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--text-muted)]/70 pl-4 mb-2 mt-7">
        API Reference
      </div>
      {API_SECTIONS.map(navLink)}

      <div className="mt-8 mx-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
        <div className="text-[11px] font-mono text-[var(--text-secondary)] leading-relaxed">
          <span className="text-[var(--gold-primary)] font-bold">{ENDPOINT_COUNT}</span> endpoints, no key
          required.
        </div>
      </div>
    </nav>
  );
}
