import Link from 'next/link';
import { MailLink, PolicyNav, withRich } from '@/components/site/legal/legal-page';
import { requestLocale } from '@/lib/core/i18n/request';
import { availablePages, pagePath, SECTIONS } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { SITE_DESCRIPTION } from '@/lib/platform/site/site-copy';
import { pageIn, sectionIn, siteText } from '@/lib/platform/site/text';

/**
 * What the map page says in words, for screen readers and for crawlers, which can't see a WebGL map.
 * Visually hidden: the map itself shows all of it.
 */
export async function HomeIntro() {
  const text = await siteText((await requestLocale()).locale);
  const t = withRich(text.t);
  const pages = availablePages();
  return (
    <div className="sr-only">
      <h1>{t('TAKIP: a live map of flights, ships, satellites and cameras')}</h1>
      <p>{t(SITE_DESCRIPTION)}</p>
      {SECTIONS.map(({ id }) => {
        const inSection = pages.filter(p => p.section === id);
        if (!inSection.length) return null;
        const section = sectionIn(text, id);
        return (
          <section key={id}>
            <h2>{section.label}</h2>
            <p>{section.blurb}</p>
            <ul>
              {inSection.map(p => <li key={p.slug}><Link href={localePath(text.locale, pagePath(p))}>{pageIn(text, p).heading}</Link></li>)}
            </ul>
          </section>
        );
      })}
      <section>
        <h2>{t('About TAKIP')}</h2>
        <p>{t.rich('TAKIP is an independent project. Write to {email} about anything on the map or these pages.', { email: <MailLink /> })}</p>
        <PolicyNav t={t} />
      </section>
    </div>
  );
}
