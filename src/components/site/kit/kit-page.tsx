'use client';

import { useEffect, useState } from 'react';
import { Actions } from './sections/actions';
import { Content } from './sections/content';
import { Foundations } from './sections/foundations';
import { Inputs } from './sections/inputs';
import { Overlays } from './sections/overlays';
import { Panels } from './sections/panels';

const SECTIONS = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'panels', label: 'Panels' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'segmented', label: 'Segmented' },
  { id: 'fields', label: 'Fields' },
  { id: 'toggles', label: 'Switch and checkbox' },
  { id: 'rows', label: 'List rows' },
  { id: 'tags', label: 'Tags and dots' },
  { id: 'stats', label: 'Stats' },
  { id: 'empty', label: 'Empty states' },
  { id: 'popover', label: 'Popover and menu' },
  { id: 'tooltip', label: 'Tooltip and keys' },
];

/** Which section the reader is in, for the contents list. */
function useCurrentSection() {
  const [current, setCurrent] = useState(SECTIONS[0].id);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(entries => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      const first = SECTIONS.find(s => seen.get(s.id));
      if (first) setCurrent(first.id);
    }, { rootMargin: '-10% 0px -70% 0px' });
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return current;
}

export default function KitPage() {
  const current = useCurrentSection();
  return (
    <div className="docs-root min-h-screen bg-surface-0 text-ink-2">
      <div className="mx-auto flex max-w-[1180px] gap-14 px-4 py-10 sm:px-8 sm:py-14">
        <aside className="sticky top-14 hidden h-[calc(100vh-112px)] w-44 shrink-0 flex-col lg:flex">
          <p className="text-title font-semibold text-ink-1">TAKIP kit</p>
          <p className="mt-1 text-small text-ink-3">src/components/ui</p>
          <nav aria-label="Sections" className="mt-8 flex flex-col">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} aria-current={current === s.id ? 'true' : undefined}
                className={`relative -ml-3 rounded-control py-1.5 pl-3 text-body transition-colors duration-150 ${current === s.id ? 'text-ink-1' : 'text-ink-3 hover:text-ink-1'}`}>
                {current === s.id && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-accent" />}
                {s.label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="mb-14 max-w-[64ch]">
            <h1 className="text-display font-semibold text-ink-1">The parts every panel is built from</h1>
            <p className="mt-2 text-body/5 text-ink-2">
              Quiet chrome, one accent, words a person would say. Each part below is shown in the states it can be in.
              The rules behind them live in docs/design/README.md; when a part here and the rules disagree, the rules win.
            </p>
          </header>
          <Foundations />
          <Panels />
          <Actions />
          <Inputs />
          <Content />
          <Overlays />
        </main>
      </div>
    </div>
  );
}
