import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { LINK_BUTTON, Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { languageName } from '@/lib/core/wikipedia/language';
import { articleUrl } from '@/lib/core/wikipedia/refs';
import { AD_SLOTS } from '@/lib/platform/ads';
import type { EventArticle as Article } from '@/lib/platform/site/events/article';
import { localePath } from '@/lib/platform/site/locale-path';
import { deepSkyHref } from '@/lib/platform/site/space/journey';
import { craftPath, rosterCraft } from '@/lib/platform/site/space/roster';
import { KIND, lightYearsText, REALMS, realmPages, SKY_INDEX_PATH, skyNote, spanText, telescope, type SkyPage } from '@/lib/platform/site/space/sky-pages';
import type { SiteText } from '@/lib/platform/site/text';
import { deepSkyUrl } from '@/lib/space/deep/deep-sky';
import { DEEP_FEATURES } from '@/lib/space/deep/features';
import { FactRows } from './parts/fact-rows';
import { DeepSkyCards } from './parts/sky-cards';
import { SpacePicture } from './parts/space-picture';

/** Shown instead of a Wikipedia lead for the pictures hung as flat sheets; the same words the space view's card says. */
const FLAT = DEEP_FEATURES['pillars-of-creation']?.footnote ?? '';

/**
 * A nebula, cluster, galaxy or black hole: its telescope picture, how far it is, what it is, who took the picture and
 * Wikipedia's summary, with the 3D view opened on it and the others in its part of the universe.
 */
export function SkyArticle({ text, page: p, article }: { text: SiteText; page: SkyPage; article: Article | null }) {
  const { t } = text;
  const name = t(p.object.name);
  const open = deepSkyHref(p.object);
  const realm = REALMS.find(r => r.id === p.object.realm)!;
  const scope = telescope(p.image);
  const craft = scope.craft ? rosterCraft(scope.craft) : null;
  const note = skyNote(p);
  const wikiHref = article?.url ?? articleUrl(p.object.wiki);
  const wikipedia = !article || article.lang === 'en' ? 'Wikipedia' : t('{language} Wikipedia', { language: languageName(article.lang, t.intl) });
  const more = realmPages(p.object.realm, p.object.id).slice(0, 8).map(x => x.object);
  return (
    <article>
      <header className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <Link href={localePath(text.locale, SKY_INDEX_PATH)} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>
            {t(KIND[p.object.kind])} · {t(realm.label)}
          </Link>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{name}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{t(p.object.subtitle)}</p>
          <div className="mt-8">
            <p className="text-[13px] text-ink-3">{t('From the Sun')}</p>
            <p className="mt-1 font-mono text-[26px] font-medium tracking-[-0.01em] text-ink-1 tabular-nums">{lightYearsText(t, p.object.ly)}</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={open} className={LINK_BUTTON.primary}>{t('Open in 3D')}<ArrowUpRight className="size-4" aria-hidden /></a>
            <a href={wikiHref} rel="noopener" className={LINK_BUTTON.secondary}>{wikipedia}</a>
          </div>
        </div>
        <SpacePicture href={open} photo={deepSkyUrl(p.object.id)} shot={null} alt={name} cta={t('Open in 3D')} className="order-first lg:order-none"
          aspect={Math.min(16 / 9, Math.max(4 / 5, p.image.width / p.image.height))}
          credit={{ label: t('Picture: {credit}', { credit: p.image.credit }), href: p.image.page }} />
      </header>

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          {note && (
            <Section title={t('What it is')}>
              <p>{t(note)}</p>
              <p className="mt-3 text-[13px] text-ink-3">{t(FLAT)}</p>
            </Section>
          )}
          <Section title={t('The picture')}>
            <FactRows rows={[
              { label: t('Taken by'), value: craft ? <Link href={localePath(text.locale, craftPath(craft))} className={TEXT_LINK}>{craft.name}</Link> : t(scope.name) },
              { label: t('Picture spans'), value: spanText(t, p) },
              { label: t('From the Sun'), value: lightYearsText(t, p.object.ly) },
              { label: t('RA / Dec'), value: `${p.image.ra.toFixed(2)}° / ${p.image.dec.toFixed(2)}°` },
              { label: t('Credit'), value: <a href={p.image.page} rel="noopener" className={TEXT_LINK}>{p.image.credit}</a> },
            ]} />
          </Section>
          {article && (
            <Section title={article.title}>
              <p>{article.extract}</p>
              <p className="mt-3 text-[13px] text-ink-3">
                {t('From {source}, CC BY-SA', { source: wikipedia })}
                {' · '}<a href={article.url} rel="noopener" className={TEXT_LINK}>{t('Read the article')}</a>
              </p>
            </Section>
          )}
        </div>
        <aside className="flex flex-col gap-4">
          <Link href={localePath(text.locale, '/map/stars-and-galaxies')} className={cx('inline-flex items-center gap-2 text-[15px] font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>
            {t('From the stars to the edge of the universe')}<ArrowUpRight className="size-4" aria-hidden />
          </Link>
          <Link href={localePath(text.locale, SKY_INDEX_PATH)} className={cx('inline-flex items-center gap-2 text-[15px] font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>
            {t('Every nebula and galaxy we show')}<ArrowUpRight className="size-4" aria-hidden />
          </Link>
          {craft && (
            <Link href={localePath(text.locale, craftPath(craft))} className={cx('inline-flex items-center gap-2 text-[15px] font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>
              {t('Where {name} is now', { name: craft.name })}<ArrowUpRight className="size-4" aria-hidden />
            </Link>
          )}
          <div className="mt-6"><AdSlot slot={AD_SLOTS.page} variant="page" /></div>
        </aside>
      </div>

      {more.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t(realm.label)}</h2>
          <div className="mt-5"><DeepSkyCards t={t} items={more} columns="sm:grid-cols-3 lg:grid-cols-4" /></div>
        </section>
      )}
    </article>
  );
}
