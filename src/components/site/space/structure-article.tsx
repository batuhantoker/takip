import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { LINK_BUTTON, Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { languageName } from '@/lib/core/wikipedia/language';
import { AD_SLOTS } from '@/lib/platform/ads';
import type { EventArticle as Article } from '@/lib/platform/site/events/article';
import { localePath } from '@/lib/platform/site/locale-path';
import { shotUrl } from '@/lib/platform/site/shots';
import { lightYearsText, SKY_INDEX_PATH } from '@/lib/platform/site/space/sky-pages';
import { groupPages, STRUCTURE_GROUPS, structureHref, type StructurePage } from '@/lib/platform/site/space/structure-pages';
import type { SiteText } from '@/lib/platform/site/text';
import { FactRows } from './parts/fact-rows';
import { SpacePicture } from './parts/space-picture';
import { StructureCards } from './parts/structure-cards';

const CMB = { src: '/data/cosmos/cmb.jpg', credit: 'ESA and the Planck Collaboration', href: 'https://www.esa.int/Science_Exploration/Space_Science/Planck' };

/**
 * A supercluster's basin, a cluster or wall of galaxies, a void or the microwave background: where it is, what it is,
 * the facts the space view's card gives, and Wikipedia's summary where it has an article, with the 3D view flown to it.
 */
export function StructureArticle({ text, page: p, article }: { text: SiteText; page: StructurePage; article: Article | null }) {
  const { t } = text;
  const f = p.feature;
  const name = t(f.name);
  const open = structureHref(p);
  const group = STRUCTURE_GROUPS.find(g => g.id === p.group)!;
  const wikipedia = !article || article.lang === 'en' ? 'Wikipedia' : t('{language} Wikipedia', { language: languageName(article.lang, t.intl) });
  const photo = p.id === 'cmb' ? CMB.src : article?.large ?? article?.image?.src ?? null;
  const credit = p.id === 'cmb' ? { label: t('Picture: {credit}', { credit: CMB.credit }), href: CMB.href }
    : article && photo ? { label: t('Picture: {credit}', { credit: wikipedia }), href: article.url } : null;
  const basin = p.group === 'basins';
  const more = groupPages(p.group, p.id).slice(0, 12);
  return (
    <article>
      <header className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <Link href={localePath(text.locale, SKY_INDEX_PATH)} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>
            {t(group.label)}
          </Link>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{name}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{t(f.subtitle, f.subtitleVars)}</p>
          <div className="mt-8">
            <p className="text-[13px] text-ink-3">{basin ? t('Attractor') : t('From the Sun')}</p>
            <p className="mt-1 font-mono text-[26px] font-medium tracking-[-0.01em] text-ink-1 tabular-nums">
              {basin ? t('{distance} from the Sun', { distance: lightYearsText(t, p.ly) }) : lightYearsText(t, p.ly)}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={open} className={LINK_BUTTON.primary}>{t('Open in 3D')}<ArrowUpRight className="size-4" aria-hidden /></a>
            {article && <a href={article.url} rel="noopener" className={LINK_BUTTON.secondary}>{wikipedia}</a>}
          </div>
        </div>
        <SpacePicture href={open} photo={photo} shot={shotUrl('stars-and-galaxies')} alt={name} cta={t('Open in 3D')} className="order-first lg:order-none"
          aspect={p.id === 'cmb' ? 2 : undefined} credit={credit} />
      </header>

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          {f.note && (
            <Section title={t('What it is')}>
              <p>{t(f.note)}</p>
              {f.footnote && <p className="mt-3 text-[13px] text-ink-3">{t(f.footnote)}</p>}
            </Section>
          )}
          {f.fields && (
            <Section title={t('In numbers')}>
              <FactRows rows={f.fields(t).map(([label, value]) => ({ label, value }))} />
            </Section>
          )}
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
            {t('Everything in the deep sky we show')}<ArrowUpRight className="size-4" aria-hidden />
          </Link>
          <div className="mt-6"><AdSlot slot={AD_SLOTS.page} variant="page" /></div>
        </aside>
      </div>

      {more.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t(group.label)}</h2>
          <div className="mt-5"><StructureCards t={t} items={more} /></div>
        </section>
      )}
    </article>
  );
}
