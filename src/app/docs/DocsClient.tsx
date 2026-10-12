'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CommandPalette, { buildPaletteItems } from './CommandPalette';
import { ApiReference } from './api-reference';
import { DocsHeader } from './docs-header';
import { DocsHero } from './docs-hero';
import { DocsRail } from './docs-rail';
import { ALL_SECTIONS } from './docs-sections';
import { DocsSidebar } from './docs-sidebar';
import {
  ConfigurationSection,
  InterfaceSection,
  OverviewSection,
  QuickStartSection,
  SelfHostingSection,
  ShortcutsSection,
} from './guide-sections';
import { OiGuideSection } from './oi-guide';

const FALLBACK_ORIGIN = 'https://osirisai.live';

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
    <div className="docs-root min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] antialiased">
      {/* Ambient wash — keeps the page from reading as a flat black slab */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(900px 480px at 12% -8%, rgba(212,175,55,0.07), transparent 65%), radial-gradient(760px 420px at 92% 4%, rgba(0,229,255,0.05), transparent 62%)',
        }}
      />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />

      <DocsHeader navOpen={navOpen} setNavOpen={setNavOpen} setPaletteOpen={setPaletteOpen} progress={progress} />

      {/* Mobile drawer scrim */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-[250] bg-black/60 backdrop-blur-sm" onClick={closeNav} />
      )}

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 md:px-8 flex gap-8 xl:gap-12">
        <DocsSidebar active={active} navOpen={navOpen} closeNav={closeNav} />

        {/* ── Content ── */}
        <main ref={mainRef} className="flex-1 min-w-0 py-12 lg:py-16 max-w-3xl">
          <DocsHero />

          <OverviewSection />
          <QuickStartSection origin={origin} />
          <SelfHostingSection />
          <ConfigurationSection />
          <InterfaceSection />
          <OiGuideSection origin={origin} />
          <ShortcutsSection />

          <ApiReference origin={origin} />

          {/* Prev / next */}
          {(prev || next) && (
            <div className="grid sm:grid-cols-2 gap-3 mt-4 mb-12">
              {prev ? (
                <a
                  href={`#${prev.id}`}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 hover:border-[var(--gold-primary)]/30 transition-colors"
                >
                  <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-muted)] mb-1">
                    ← Previous
                  </div>
                  <div className="text-[12px] text-[var(--text-primary)]">{prev.title}</div>
                </a>
              ) : (
                <div />
              )}
              {next && (
                <a
                  href={`#${next.id}`}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 hover:border-[var(--gold-primary)]/30 transition-colors sm:text-right"
                >
                  <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-muted)] mb-1">
                    Next →
                  </div>
                  <div className="text-[12px] text-[var(--text-primary)]">{next.title}</div>
                </a>
              )}
            </div>
          )}

          {/* Footer */}
          <footer className="border-t border-white/[0.06] pt-6 pb-16 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-mono text-[var(--text-muted)]">
            {[
              { href: 'https://github.com/simplifaisoul/osiris', label: 'GitHub' },
              { href: 'https://discord.gg/EPaFD5FFKf', label: 'Discord' },
              { href: 'https://x.com/soulsimplifai', label: 'X' },
              { href: 'https://github.com/simplifaisoul/osiris/issues', label: 'Report an issue' },
            ].map(l => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--gold-primary)] transition-colors"
              >
                {l.label}
              </a>
            ))}
            <span className="ml-auto opacity-60">MIT Licensed</span>
          </footer>
        </main>

        <DocsRail active={active} />
      </div>
    </div>
  );
}
