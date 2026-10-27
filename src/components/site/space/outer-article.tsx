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
import { distanceText } from '@/lib/platform/site/space/copy';
import { isVisitor, outerOpenPath, type OuterPage } from '@/lib/platform/site/space/outer-page';
import { OUTER_BODIES, planetPath } from '@/lib/platform/site/space/planets';
import type { SiteText } from '@/lib/platform/site/text';
import { DWARF_PLANETS, VISITORS } from '@/lib/space/deep/outer';
import { lightTime } from '@/lib/space/format';
import { FactRows } from './parts/fact-rows';
import { NowBox } from './parts/now-box';
import { SpacePicture } from './parts/space-picture';

const nameOf = (key: string) => [...DWARF_PLANETS, ...VISITORS].find(b => b.key === key)?.name ?? key;

/**
 * A dwarf planet past Neptune or an interstellar visitor: how far it is now, placed as the space view places it,
 * what it is, and Wikipedia's summary, with the others of its kind.
 */
export function OuterArticle({ text, page: p, article, shot }: { text: SiteText; page: OuterPage; article: Article | null; shot: string | null }) {
  const { t } = text;
  const name = p.def.name;
  const visitor = isVisitor(p.def) ? p.def : null;
  const open = outerOpenPath(p);
  const wikiHref = article?.url ?? articleUrl(p.entry.wiki);
  const wikipedia = !article || article.lang === 'en' ? 'Wikipedia' : t('{language} Wikipedia', { language: languageName(article.lang, t.intl) });
  const others = OUTER_BODIES.filter(o => o.kind === p.entry.kind && o.key !== p.entry.key);
  return (
    <article>
      <header className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <Link href={localePath(text.locale, '/spacecraft')} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>
            {visitor ? t('Interstellar object · {designation}', { designation: visitor.designation }) : t('Dwarf planet')}
          </Link>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{name}</h1>
          {article?.description && <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{article.description}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={open} className={LINK_BUTTON.primary}>{t('Open in 3D')}<ArrowUpRight className="size-4" aria-hidden /></a>
            <a href={wikiHref} rel="noopener" className={LINK_BUTTON.secondary}>{wikipedia}</a>
          </div>
          {p.now && (
            <NowBox t={t} at={p.now.at} className="mt-8" title={t('How far is {planet} from Earth?', { planet: name })}>
              <p className="text-[22px] font-semibold tracking-[-0.01em]">{distanceText(t, p.now.earthKm)}</p>
              <p>{t('Its light takes {light} to reach us.', { light: lightTime(p.now.lightSec, t) })}</p>
              <p className="text-ink-2">{t('{distance} from the Sun.', { distance: distanceText(t, p.now.sunKm) })}</p>
            </NowBox>
          )}
        </div>
        <SpacePicture href={open} photo={article?.large ?? article?.image?.src ?? null} shot={shot} alt={name} cta={t('Open in 3D')}
          credit={article?.image ? { label: t('Picture from {source}', { source: wikipedia }), href: wikiHref } : null} />
      </header>

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          {visitor && (
            <Section title={t('What it is')}>
              <p>{t(visitor.note)}</p>
              <p className="mt-3 text-[13px] text-ink-3">{t('Its line in the space view is the real path through the solar system, 1990–2060.')}</p>
            </Section>
          )}
          <Section title={t('In numbers')}>
            <FactRows rows={[
              ...(visitor ? [{ label: t('Designation'), value: visitor.designation }, { label: t('Perihelion'), value: visitor.perihelion }] : []),
              { label: t('Radius'), value: `${p.def.radiusKm.toLocaleString(t.intl)} km` },
              ...(p.now ? [{ label: t('From the Sun'), value: distanceText(t, p.now.sunKm) }] : []),
            ]} />
            <p className="mt-3 text-[13px] text-ink-3">{t('Position and orbit from JPL Horizons')}</p>
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
        <aside className="flex flex-col gap-10">
          <Link href={localePath(text.locale, '/map/solar-system-3d')} className={cx('inline-flex items-center gap-2 text-[15px] font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>
            {t('The solar system in 3D')}<ArrowUpRight className="size-4" aria-hidden />
          </Link>
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      <section className="mt-20">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{visitor ? t('The other interstellar visitors') : t('The other dwarf planets')}</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {!visitor && <li><Link href={localePath(text.locale, '/planet/pluto')} className={cx(LINK_BUTTON.secondary)}>{t('Pluto')}</Link></li>}
          {others.map(o => (
            <li key={o.key}><Link href={localePath(text.locale, planetPath(o))} className={cx(LINK_BUTTON.secondary)}>{nameOf(o.key)}</Link></li>
          ))}
        </ul>
      </section>
    </article>
  );
}
