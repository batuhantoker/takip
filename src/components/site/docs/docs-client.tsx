'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { AD_SLOTS } from '@/lib/ads/ads';
import CommandPalette, { buildPaletteItems } from '@/components/site/docs/parts/command-palette';
import { ApiReference } from '@/components/site/docs/parts/api-reference';
import { DocsHeader } from '@/components/site/docs/parts/docs-header';
import { DocsHero } from '@/components/site/docs/parts/docs-hero';
import { DocsRail } from '@/components/site/docs/parts/docs-rail';
import { ALL_SECTIONS } from './docs-sections';
import { DocsSidebar } from '@/components/site/docs/parts/docs-sidebar';
import {
  ConfigurationSection,
  InterfaceSection,
  OverviewSection,
  QuickStartSection,
  SelfHostingSection,
  ShortcutsSection,
} from '@/components/site/docs/parts/guide-sections';
import { OiGuideSection } from '@/components/site/docs/parts/ti-guide';

const FALLBACK_ORIGIN = 'https://takip.example';

export default function DocsClient() {
  const [active, setActive] = useState('overview');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [origin, setOrigin] = useState(FALLBACK_ORIGIN);
  const mainRef = useRef<HTMLElement>(null);

  const paletteItems = useMemo(() => buildPaletteItems(ALL_SECTIONS), []);

  /* Snippets should reference the instance the reader is actually on. */
  useEffect(() => setOrigin(window.location.origin), []);

  /* Belt-and-braces scroll unlock: globals.css handles this via :has(),
     but release the lock imperatively for engines without :has() support. */
  useEffect(() => {
    const supportsHas = typeof CSS !== 'undefined' && CSS.supports?.('selector(:has(*))');
    if (supportsHas) return;
    const { documentElement: html, body } = document;
    const prev = { html: html.style.cssText, body: body.style.cssText };
    for (const el of [html, body]) {
      el.style.height = 'auto';
      el.style.overflowY = 'auto';
      el.style.overflowX = 'hidden';
    }
    return () => {
      html.style.cssText = prev.html;
      body.style.cssText = prev.body;
    };
  }, []);

  /* Scroll-spy + reading progress. */
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -72% 0px', threshold: 0 }
    );
    ALL_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  /* ⌘K / Ctrl-K, and "/" as a plain-keyboard alternative. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Close the mobile drawer once a destination is chosen. */
  const closeNav = useCallback(() => setNavOpen(false), []);

  const activeIdx = ALL_SECTIONS.findIndex(s => s.id === active);
  const prev = activeIdx > 0 ? ALL_SECTIONS[activeIdx - 1] : null;
  const next = activeIdx >= 0 && activeIdx < ALL_SECTIONS.length - 1 ? ALL_SECTIONS[activeIdx + 1] : null;

  return (
    <div className="docs-root min-h-screen bg-surface-0 text-ink-1 antialiased">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />

      <DocsHeader navOpen={navOpen} setNavOpen={setNavOpen} setPaletteOpen={setPaletteOpen} progress={progress} />

      {/* Mobile drawer scrim */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-[250] bg-black/60" onClick={closeNav} />
      )}

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 md:px-8 flex gap-8 xl:gap-12">
        <DocsSidebar active={active} navOpen={navOpen} closeNav={closeNav} />

        {/* ── Content ── */}
        <main ref={mainRef} className="flex-1 min-w-0 py-12 lg:py-16 max-w-[44rem]">
          <DocsHero />

          <OverviewSection />
          <QuickStartSection origin={origin} />
          <SelfHostingSection />
          <ConfigurationSection />
          <InterfaceSection />
          <OiGuideSection origin={origin} />
          <ShortcutsSection />

          <AdSlot slot={AD_SLOTS.page} variant="page" className="my-12" />

          <ApiReference origin={origin} />

          {/* Prev / next */}
          {(prev || next) && (
            <div className="grid sm:grid-cols-2 gap-3 mt-4 mb-12">
              {prev ? (
                <a
                  href={`#${prev.id}`}
                  className="rounded-card border border-line bg-surface-1 p-4 hover:bg-surface-2 transition-colors"
                >
                  <div className="text-[12px] text-ink-3 mb-1">← Previous</div>
                  <div className="text-[14px] font-medium text-ink-1">{prev.title}</div>
                </a>
              ) : (
                <div />
              )}
              {next && (
                <a
                  href={`#${next.id}`}
                  className="rounded-card border border-line bg-surface-1 p-4 hover:bg-surface-2 transition-colors sm:text-right"
                >
                  <div className="text-[12px] text-ink-3 mb-1">Next →</div>
                  <div className="text-[14px] font-medium text-ink-1">{next.title}</div>
                </a>
              )}
            </div>
          )}

          {/* Footer */}
          <footer className="border-t border-line pt-6 pb-16 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-3">
            {[
              { href: 'https://github.com/batuhantoker/takip', label: 'GitHub' },
              { href: 'https://discord.gg/EPaFD5FFKf', label: 'Discord' },
              { href: 'https://x.com/soulsimplifai', label: 'X' },
              { href: 'https://github.com/batuhantoker/takip/issues', label: 'Report an issue' },
            ].map(l => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ink-1 transition-colors"
              >
                {l.label}
              </a>
            ))}
            <span className="ml-auto">MIT licence</span>
          </footer>
        </main>

        <DocsRail active={active} />
      </div>
    </div>
  );
}
