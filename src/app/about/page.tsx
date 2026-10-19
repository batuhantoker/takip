import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { MapWindow } from '@/components/site/pages/map-window';
import { SECTION_ICON } from '@/components/site/pages/section-icon';
import { Bullets, LINK_BUTTON, Section, SiteFrame, TEXT_LINK } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { AD_SLOTS } from '@/lib/platform/ads';
import { ABOUT, type AboutKey } from '@/lib/platform/site/about-copy';
import { layerPage, openPath, SECTIONS } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingImage, readingMetadata } from '@/lib/platform/site/meta';
import { shotUrl } from '@/lib/platform/site/shots';
import { pageIn, sectionIn, siteText } from '@/lib/platform/site/text';

/** The four pictures on the wall: the live map, the past and space, so the range shows at a glance. */
const WALL = ['flight-tracker', 'world-map-1914', 'solar-system-3d', 'earthquakes'];

async function aboutText() {
  const text = await siteText((await requestLocale()).locale);
  const s = (key: AboutKey) => {
    const v = text.copy.about?.[key];
    return (typeof v === 'string' ? v : ABOUT[key]) as string;
  };
  const list = (key: AboutKey) => {
    const v = text.copy.about?.[key];
    const en = ABOUT[key] as string[];
    return Array.isArray(v) && v.length === en.length ? v : en;
  };
  return { text, s, list };
}

export async function generateMetadata(): Promise<Metadata> {
  const { text, s } = await aboutText();
  return readingMetadata({ locale: text.locale, path: '/about', title: s('title'), description: s('description'), image: readingImage('about', text.locale) });
}

export default async function AboutPage() {
  const { text, s, list } = await aboutText();
  const { t } = text;
  const wall = WALL.map(slug => layerPage(slug)).filter(p => !!p).map(p => pageIn(text, p));
  return (
    <SiteFrame t={t} path="/about" trail={[{ href: localePath(text.locale, '/about'), label: t('About') }]}>
      <header className="mt-8 grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <p className="text-[13px] font-medium text-ink-3">{s('kicker')}</p>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{s('heading')}</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{s('lede')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={LINK_BUTTON.primary}>{t('Open the live map')}<ArrowUpRight className="size-4" aria-hidden /></Link>
            <Link href={localePath(text.locale, '/map')} className={LINK_BUTTON.secondary}>{t('Everything on the map')}</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {wall.map((p, i) => (
            <MapWindow key={p.slug} href={openPath(p)} image={shotUrl(p.slug)} alt={p.heading} cta={p.heading} priority={i < 2}
              className="[&>span:last-child]:h-8 [&>span:last-child]:px-2.5 [&>span:last-child]:text-[12px]" />
          ))}
        </div>
      </header>

      <div className="mt-20 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div className="max-w-[44rem]">
          <Section title={s('whyTitle')}>
            {list('why').map((p, i) => <p key={p} className={i ? 'mt-4' : undefined}>{p}</p>)}
          </Section>
          <Section title={s('moreTitle')}>
            <Bullets items={list('more')} />
          </Section>
          <Section title={s('honestTitle')}>
            <p>{s('honest')}</p>
          </Section>
          <Section title={s('freeTitle')}>
            <p>{s('free')}</p>
            <p className="mt-4"><Link href="/privacy" className={TEXT_LINK}>{t('Read the privacy page')}</Link></p>
          </Section>
        </div>
        <aside className="flex flex-col gap-10">
          <section>
            <h2 className="text-[15px] font-semibold text-ink-1">{s('onMapTitle')}</h2>
            <ul className="mt-4 flex flex-col gap-1">
              {SECTIONS.map(({ id }) => {
                const section = sectionIn(text, id);
                const Icon = SECTION_ICON[id];
                return (
                  <li key={id}>
                    <Link href={`${localePath(text.locale, '/map')}#${id}`} className="group flex gap-3 rounded-card px-2 py-2 hover:bg-surface-1">
                      <Icon className="mt-0.5 size-4 flex-shrink-0 text-ink-3 group-hover:text-ink-1" aria-hidden />
                      <span>
                        <span className="block text-[14px] font-medium text-ink-1">{section.label}</span>
                        <span className="block text-[13px] leading-snug text-ink-3">{section.blurb}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>
    </SiteFrame>
  );
}
