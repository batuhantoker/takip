import type { Metadata } from 'next';
import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { SECTION_ICON } from '@/components/site/pages/section-icon';
import { SiteFrame } from '@/components/site/pages/site-frame';
import { availableGuides, guideBySlug, guideOpenPath, guidePath } from '@/lib/platform/site/guides/guides';
import { siteText } from '@/lib/platform/site/text';
import { GuideArticle } from './guide-article';

/*
 * The guides are written in English and have one URL until they are translated; a /tr/ copy with an English body
 * would only be a duplicate. So they render in English whatever the visitor's language.
 */

const ogImage = (query: string) => `/og?${query.replace(/^\/\??/, '')}`;

export async function guideMetadata(slug: string): Promise<Metadata> {
  const guide = guideBySlug(slug);
  if (!guide) return {};
  const url = guidePath(guide);
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: { title: guide.title, description: guide.description, url, type: 'article', siteName: 'TAKIP', locale: 'en_US', images: [{ url: ogImage(guideOpenPath(guide)), width: 1200, height: 630, alt: guide.title }] },
  };
}

export async function GuidePage({ slug }: { slug: string }) {
  const guide = guideBySlug(slug);
  if (!guide) return null;
  const text = await siteText('en');
  const { t } = text;
  const others = availableGuides().filter(g => g !== guide);
  return (
    <SiteFrame t={t} path={guidePath(guide)} trail={[{ href: '/guides', label: t('Guides') }]}>
      <GuideArticle text={text} guide={guide} others={others} />
    </SiteFrame>
  );
}

export async function guidesIndexMetadata(): Promise<Metadata> {
  const title = 'Guides: tracking flights, ships, weather and history on a map';
  const description = 'How to track flights, ships and buses live, read airport weather, spot GPS jamming and explore history on TAKIP’s free map, checked against its data.';
  return { title, description, alternates: { canonical: '/guides' }, openGraph: { title, description, url: '/guides', type: 'website', siteName: 'TAKIP', locale: 'en_US' } };
}

export async function GuidesIndex() {
  const text = await siteText('en');
  const { t } = text;
  const guides = availableGuides();
  return (
    <SiteFrame t={t} path="/guides" trail={[{ href: '/map', label: t('On the map') }]}>
      <header className="mt-8 max-w-[44rem]">
        <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('Guides')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          How to use the live map for the things people look up: following a flight or a bus, reading the weather, spotting GPS jamming, and the history behind the borders. Each one is checked against the data the map really has.
        </p>
      </header>
      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map(g => {
          const Icon = SECTION_ICON[g.section];
          return (
            <li key={g.slug}>
              <Link href={guidePath(g)} className={cx('flex h-full flex-col gap-2 rounded-card border border-line bg-surface-1 p-5 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
                <Icon className="size-4 text-ink-3" aria-hidden />
                <span className="text-[16px] font-semibold text-ink-1">{g.heading}</span>
                <span className="text-[13px] leading-relaxed text-ink-3">{g.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SiteFrame>
  );
}
