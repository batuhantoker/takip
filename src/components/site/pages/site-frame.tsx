import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { LOCALES, LOCALE_NAMES } from '@/lib/core/i18n/locales';
import type { Translate } from '@/lib/core/i18n/translator';
import { isReadingPath, localePath } from '@/lib/platform/site/locale-path';

/** The kit's primary and secondary buttons, for links. */
export const LINK_BUTTON = {
  primary: cx('inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-[14px] font-medium text-on-accent hover:bg-accent/90', FOCUS_RING, TRANSITION),
  secondary: cx('inline-flex h-10 items-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 text-[14px] font-medium text-ink-1 hover:bg-surface-3', FOCUS_RING, TRANSITION),
};

export const TEXT_LINK = cx('text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-ink-2', FOCUS_RING);

/**
 * The frame of TAKIP's public reading pages: a trail back, the page, and a footer with the other pages and this
 * page in every language. `path` is the page's English path; links follow the reader's language.
 */
export function SiteFrame({ t, path, trail = [], children }: {
  t: Translate;
  path: string;
  trail?: { href: string; label: string }[];
  children: ReactNode;
}) {
  const here = (p: string) => localePath(t.locale, p);
  const footer = [
    { href: '/', label: t('Open the map') },
    { href: here('/map'), label: t('Everything on the map') },
    { href: here('/about'), label: t('About TAKIP') },
    { href: '/docs', label: t('Docs and API') },
    { href: '/privacy', label: t('Privacy') },
  ];
  return (
    // docs-root releases the full-screen map's scroll lock (see globals.css), so the page scrolls.
    <main className="docs-root min-h-screen bg-surface-0 px-5 py-10 text-ink-1 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-[72rem]">
        <nav aria-label={t('Breadcrumb')} className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          <Link href="/" className={cx('font-semibold tracking-[0.02em] text-ink-1 hover:text-accent', FOCUS_RING)}>TAKIP</Link>
          {trail.map(c => (
            <span key={c.href} className="flex items-center gap-2">
              <span aria-hidden>/</span>
              <Link href={c.href} className={cx('hover:text-ink-1', FOCUS_RING)}>{c.label}</Link>
            </span>
          ))}
        </nav>
        {children}
        <footer className="mt-24 grid gap-8 border-t border-line pt-8 text-[13px] leading-relaxed text-ink-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <p className="max-w-[36rem]">{t('TAKIP is a free live map of public data: flights, ships, satellites, cameras, weather, earthquakes and news, gathered onto one map.')}</p>
            <p className="mt-2 max-w-[36rem] text-[12px]">{t('Places from GeoNames (CC BY 4.0), with names from Wikidata.')}</p>
            <nav aria-label={t('More from TAKIP')} className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {footer.map(l => <Link key={l.href} href={l.href} className={cx('hover:text-ink-1', FOCUS_RING)}>{l.label}</Link>)}
            </nav>
          </div>
          {/* A page with one URL in every language (the guides, until translated) has no other languages to offer. */}
          {isReadingPath(path) && <nav aria-label={t('This page in other languages')} className="flex flex-wrap content-start gap-x-4 gap-y-2">
            {LOCALES.map(l => (
              <a key={l} href={localePath(l, path)} hrefLang={l} lang={l} aria-current={l === t.locale ? 'page' : undefined}
                className={cx(l === t.locale ? 'text-ink-1' : 'hover:text-ink-1', FOCUS_RING, TRANSITION)}>
                {LOCALE_NAMES[l]}
              </a>
            ))}
          </nav>}
        </footer>
      </div>
    </main>
  );
}

export function Section({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('mt-12 first:mt-0', className)}>
      <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{title}</h2>
      <div className="mt-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-ink-4">
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
}
