import type { Metadata } from 'next';
import Link from 'next/link';
import { MailLink, PolicyNav, withRich } from '@/components/site/legal/legal-page';
import { LINK_BUTTON } from '@/components/site/pages/site-frame';
import { getT } from '@/lib/core/i18n/request';
import { localePath } from '@/lib/platform/site/locale-path';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Page not found') };
}

export default async function NotFound() {
  const t = withRich(await getT());
  const elsewhere = [
    { href: localePath(t.locale, '/map'), label: t('Everything on the map') },
    { href: '/guides', label: t('Guides') },
    { href: '/docs', label: t('Docs and API') },
  ];
  return (
    // docs-root releases the full-screen map's scroll lock (see globals.css), so the page scrolls.
    <main className="docs-root min-h-screen bg-surface-0 px-5 py-14 text-ink-1 sm:px-6">
      <div className="mx-auto max-w-[44rem]">
        <Link href="/" className="text-[13px] text-ink-3 hover:text-ink-1">{t('← Back to TAKIP')}</Link>

        <header className="mt-8">
          <p className="font-mono text-[13px] font-medium text-ink-3">404</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">{t('This page is not on the map')}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            {t('The address may be mistyped, or the page may have moved. The rest of TAKIP is still here.')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={LINK_BUTTON.primary}>{t('Open the live map')}</Link>
            {elsewhere.map(l => <Link key={l.href} href={l.href} className={LINK_BUTTON.secondary}>{l.label}</Link>)}
          </div>
        </header>

        <p className="mt-12 text-sm leading-relaxed text-ink-2">
          {t.rich('If a link on TAKIP brought you here, tell us at {email} and we will fix it.', { email: <MailLink /> })}
        </p>

        <footer className="mt-14 border-t border-line pt-5 text-[12px] text-ink-3">
          <PolicyNav t={t} />
        </footer>
      </div>
    </main>
  );
}
