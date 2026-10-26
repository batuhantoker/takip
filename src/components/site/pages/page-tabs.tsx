'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';

export interface PageTab { href: string; label: string; here?: boolean }

/** How far down the screen a section's top has to come before its tab is the one being read. */
const READ_LINE = 0.3;

const tabClass = (here: boolean) => cx('relative inline-flex h-11 shrink-0 items-center whitespace-nowrap px-3 text-[14px] font-medium', FOCUS_RING, TRANSITION,
  here ? 'text-ink-1' : 'text-ink-2 hover:text-ink-1');

/**
 * A reading page's row of text tabs, sticky at the top; on a phone it scrolls sideways with the current tab in view.
 * Tabs to `#id` sections of the page mark the section being read.
 */
export function PageTabs({ label, tabs }: { label: string; tabs: PageTab[] }) {
  const row = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const ids = tabs.flatMap(tab => (tab.href.startsWith('#') ? [tab.href.slice(1)] : [])).join(' ');

  useEffect(() => {
    if (!ids) return;
    const sections = ids.split(' ').flatMap(id => document.getElementById(id) ?? []);
    // A section a filter has hidden has no box, and would read as passed.
    const read = () => setReading(sections.filter(el => el.getClientRects().length > 0 && el.getBoundingClientRect().top < innerHeight * READ_LINE).at(-1)?.id ?? null);
    read();
    addEventListener('scroll', read, { passive: true });
    return () => removeEventListener('scroll', read);
  }, [ids]);

  useEffect(() => {
    const el = row.current;
    const here = el?.querySelector<HTMLElement>('[data-here]');
    // Not scrollIntoView, which would move the page too.
    if (el && here) el.scrollLeft = here.offsetLeft - (el.clientWidth - here.offsetWidth) / 2;
  }, [reading]);

  return (
    <nav aria-label={label} className="sticky top-0 z-20 mt-6 border-b border-line bg-surface-0/95 backdrop-blur">
      <div ref={row} className="relative -mx-3 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(tab => {
          const anchor = tab.href.startsWith('#');
          const here = anchor ? tab.href === `#${reading}` : !!tab.here;
          const inner = <>{tab.label}{here && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}</>;
          return anchor
            ? <a key={tab.href} href={tab.href} data-here={here || undefined} className={tabClass(here)}>{inner}</a>
            : <Link key={tab.href} href={tab.href} aria-current={here ? 'page' : undefined} data-here={here || undefined} className={tabClass(here)}>{inner}</Link>;
        })}
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-0 sm:hidden" />
    </nav>
  );
}
