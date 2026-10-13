'use client';

import { ENDPOINT_COUNT } from '@/components/site/docs/api-catalog';
import { API_SECTIONS, GUIDE_SECTIONS } from '@/components/site/docs/docs-sections';

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
      className={`relative block pl-4 pr-3 py-[7px] text-[13px] rounded-r-md transition-colors ${
        active === s.id ? 'text-ink-1 bg-surface-3 font-medium' : 'text-ink-2 hover:text-ink-1 hover:bg-surface-2'
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full ${
          active === s.id ? 'h-[70%] bg-accent' : 'h-0 bg-transparent'
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
      } fixed lg:sticky top-14 left-0 bottom-0 lg:bottom-auto z-[260] lg:z-auto w-64 lg:w-56 shrink-0 lg:h-[calc(100vh-3.5rem)] overflow-y-auto styled-scrollbar bg-surface-1 lg:bg-transparent border-r lg:border-r-0 border-line py-6 pr-2 pl-2 lg:pl-0 transition-[opacity,translate] duration-150`}
    >
      <div className="text-[12px] font-medium text-ink-3 pl-4 mb-2">Guide</div>
      {GUIDE_SECTIONS.map(navLink)}

      <div className="text-[12px] font-medium text-ink-3 pl-4 mb-2 mt-7">API reference</div>
      {API_SECTIONS.map(navLink)}

      <p className="mt-8 mx-2 pl-2 text-[12px] text-ink-3">
        <span className="font-mono text-ink-2 tabular-nums">{ENDPOINT_COUNT}</span> endpoints, no key required.
      </p>
    </nav>
  );
}
