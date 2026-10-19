import Link from 'next/link';
import { requestLocale } from '@/lib/core/i18n/request';
import { availablePages, pagePath } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { SITE_DESCRIPTION } from '@/lib/platform/site/site-copy';
import { pageIn, siteText } from '@/lib/platform/site/text';

/**
 * What the map page says in words, for screen readers and for crawlers, which can't see a WebGL map.
 * Visually hidden: the map itself shows all of it.
 */
export async function HomeIntro() {
  const text = await siteText((await requestLocale()).locale);
  const { t } = text;
  return (
    <div className="sr-only">
      <h1>{t('TAKIP: a live map of the world')}</h1>
      <p>{t(SITE_DESCRIPTION)}</p>
      <nav aria-label={t('Layers explained')}>
        <ul>
          {availablePages().map(p => <li key={p.slug}><Link href={localePath(text.locale, pagePath(p))}>{pageIn(text, p).heading}</Link></li>)}
        </ul>
      </nav>
      <Link href={localePath(text.locale, '/about')}>{t('About TAKIP')}</Link>
    </div>
  );
}
