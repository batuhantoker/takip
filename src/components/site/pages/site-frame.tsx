import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { PageView } from '@/components/site/page-view';
import { LOCALES, LOCALE_NAMES } from '@/lib/core/i18n/locales';
import type { Translate } from '@/lib/core/i18n/translator';
import { appsOut } from '@/lib/platform/native/downloads';
import { POLICY_LINKS } from '@/lib/platform/site/legal';
import { isReadingPath, localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { searchScope } from '@/lib/platform/site/search-scope';

export { Bullets, LINK_BUTTON, Section, TEXT_LINK } from './site-parts';

/**
 * The frame of TAKIP's public reading pages: a trail back, the page, and a footer with the other pages and this
 * page in every language. `path` is the page's English path; links follow the reader's language. `indexed` false: a page
 * kept out of search, whose other languages crawlers aren't sent to.
 */
export async function SiteFrame({ t, path, trail = [], indexed = true, credits, children }: {
  t: Translate;
  path: string;
  trail?: { href: string; label: string; rel?: string }[];
  indexed?: boolean;
  /** The page's own data credit, under the site's. */
  credits?: string;
  children: ReactNode;
}) {
  const here = (p: string) => localePath(t.locale, p);
  const footer = [
    { href: '/', label: t('Open the map') },
    { href: here('/map'), label: t('Everything on the map') },
    { href: '/docs', label: t('Docs and API') },
    // Only once there is something to get (latest.json or a store listing).
    ...(await appsOut() ? [{ href: here('/download'), label: t('Apps') }] : []),
    ...POLICY_LINKS.map(l => ({ href: here(l.href), label: t(l.label) })),
  ];
  return (
    // docs-root releases the full-screen map's scroll lock (see globals.css), so the page scrolls.
    <main className="docs-root min-h-screen bg-surface-0 px-5 py-10 text-ink-1 sm:px-8 sm:py-12">
      <PageView path={path} locale={t.locale} />
      <div className="mx-auto max-w-[72rem]">
        <nav aria-label={t('Breadcrumb')} className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          <Link href="/" className={cx('font-semibold tracking-[0.02em] text-ink-1 hover:text-accent', FOCUS_RING)}>TAKIP</Link>
          {trail.map(c => (
            <span key={c.href} className="flex items-center gap-2">
              <span aria-hidden>/</span>
              <Link href={c.href} rel={c.rel} className={cx('hover:text-ink-1', FOCUS_RING)}>{c.label}</Link>
            </span>
          ))}
        </nav>
        {children}
        <footer className="mt-24 grid gap-8 border-t border-line pt-8 text-[13px] leading-relaxed text-ink-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <p className="max-w-[36rem]">{t('TAKIP is a free live map of public data: flights, ships, satellites, cameras, weather, earthquakes and news, gathered onto one map.')}</p>
            <p className="mt-2 max-w-[36rem] text-[12px]">{t('Places from GeoNames (CC BY 4.0), with names from Wikidata.')}</p>
            {credits && <p className="mt-1 max-w-[36rem] text-[12px]">{credits}</p>}
            <nav aria-label={t('More from TAKIP')} className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {footer.map(l => <Link key={l.href} href={l.href} className={cx('hover:text-ink-1', FOCUS_RING)}>{l.label}</Link>)}
            </nav>
          </div>
          {/* A page with one URL in every language (the guides, until translated) has no other languages to offer. Folded:
              few readers switch, and the head's alternates tell search engines about the others. */}
          {isReadingPath(path) && (
            <details className="group self-start md:justify-self-end">
              <summary title={t('This page in other languages')} className={cx('inline-flex cursor-pointer list-none items-center gap-1.5 hover:text-ink-1 [&::-webkit-details-marker]:hidden', FOCUS_RING, TRANSITION)}>
                <span className="sr-only">{t('Language')}: </span>{LOCALE_NAMES[t.locale]}
                <ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <nav aria-label={t('This page in other languages')} className="mt-3 flex max-w-[24rem] flex-wrap gap-x-4 gap-y-2">
                {LOCALES.map(l => (
                  <a key={l} href={localePath(l, path)} hrefLang={l} lang={l} rel={crawlRel(indexed && searchScope(path, l))} aria-current={l === t.locale ? 'page' : undefined}
                    className={cx(l === t.locale ? 'text-ink-1' : 'hover:text-ink-1', FOCUS_RING, TRANSITION)}>
                    {LOCALE_NAMES[l]}
                  </a>
                ))}
              </nav>
            </details>
          )}
        </footer>
      </div>
    </main>
  );
}

