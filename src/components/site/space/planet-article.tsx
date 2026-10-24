import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { LINK_BUTTON, Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { languageName } from '@/lib/core/wikipedia/language';
import { articleUrl } from '@/lib/core/wikipedia/refs';
import { AD_SLOTS } from '@/lib/platform/ads';
import type { EventArticle as Article } from '@/lib/platform/site/events/article';
import { pagePath, layerPage } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { bigKm, bodyName, distanceText, flightDate } from '@/lib/platform/site/space/copy';
import { planetOpenPath, type PlanetPage, type PlanetVisit } from '@/lib/platform/site/space/planet-page';
import { planetPath, PLANETS } from '@/lib/platform/site/space/planets';
import { craftPath } from '@/lib/platform/site/space/roster';
import type { SiteText } from '@/lib/platform/site/text';
import { latLng, lightTime } from '@/lib/space/format';
import { CraftCards } from './parts/craft-cards';
import { NowBox } from './parts/now-box';
import { SpacePicture } from './parts/space-picture';

// The flight's own present-tense steps, which read right for a past visit and a predicted one alike.
function visitText(t: Translate, v: PlanetVisit, planet: string): string {
  if (v.kind === 'flyby' && v.km !== null) return t('Flies past {body}, {km, distance} away', { body: planet, km: v.km });
  if (v.kind === 'landing') return t('Lands on {body}', { body: planet });
  return t('Arrives at {body}', { body: planet });
}

function Visits({ t, visits, planet }: { t: Translate; visits: PlanetVisit[]; planet: string }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {visits.map(v => {
        const body = (
          <>
            <span className="text-[14px] font-medium text-ink-1">{v.name}</span>
            <span className="text-[12px] text-ink-3">
              {[flightDate(t, v.jd), visitText(t, v, planet), v.expected && t('expected')].filter(Boolean).join(' · ')}
            </span>
          </>
        );
        const box = 'flex h-full flex-col gap-0.5 rounded-card border border-line bg-surface-1 px-3.5 py-2.5';
        return (
          <li key={`${v.id}-${v.kind}`}>
            {v.craft
              ? <Link href={localePath(t.locale, craftPath(v.craft))} className={cx(box, 'hover:border-line-strong', FOCUS_RING, TRANSITION)}>{body}</Link>
              : <div className={box}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A planet now: how far it is (JPL Horizons), the spacecraft there and the ones that went, on Mars the rovers and
 * every landing site, and Wikipedia's summary. A way into the space view, opened on the planet.
 */
export function PlanetArticle({ text, page: p, article, shot }: { text: SiteText; page: PlanetPage; article: Article | null; shot: string | null }) {
  const { t } = text;
  const name = bodyName(t, p.planet.key);
  const open = planetOpenPath(p);
  const wikiHref = article?.url ?? articleUrl(p.planet.wiki);
  const wikipedia = !article || article.lang === 'en' ? 'Wikipedia' : t('{language} Wikipedia', { language: languageName(article.lang, t.intl) });
  const globe = p.planet.layerPage ? layerPage(p.planet.layerPage) : null;
  const trend = p.now?.trendKmDay ?? null;
  const unpaged = p.there?.craft.filter(c => !c.page) ?? [];
  return (
    <article>
      <header className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <Link href={localePath(text.locale, '/spacecraft')} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>
            {p.planet.key === 'pluto' ? t('Dwarf planet') : t('Planet')}
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
              {trend !== null && Math.abs(trend) >= 1 && (
                <p className="text-ink-2">
                  {trend < 0
                    ? t('Getting closer by {amount} a day.', { amount: bigKm(t, -trend) })
                    : t('Moving away by {amount} a day.', { amount: bigKm(t, trend) })}
                </p>
              )}
              <p className="text-ink-2">{t('{distance} from the Sun.', { distance: distanceText(t, p.now.sunKm) })}</p>
            </NowBox>
          )}
        </div>
        <SpacePicture href={open} photo={article?.large ?? article?.image?.src ?? null} shot={shot} alt={name} cta={t('Open in 3D')}
          credit={article?.image ? { label: t('Picture from {source}', { source: wikipedia }), href: wikiHref } : null} />
      </header>

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          {p.rovers.length > 0 && (
            <Section title={t('Rovers on Mars now')}>
              <CraftCards t={t} items={p.rovers.filter(r => r.page).map(r => ({
                craft: r.page!,
                detail: [r.sol !== null && t('sol {sol}', { sol: r.sol.toLocaleString(t.intl) }), latLng(r.lat, r.lng), r.driveKm !== null && t('{km, distance} driven', { km: r.driveKm })].filter(Boolean).join(' · '),
              }))} />
              <p className="mt-3 text-[13px] text-ink-3">{t('Positions from NASA’s “Where is the rover?” maps.')}</p>
            </Section>
          )}

          {p.there && p.there.craft.length > 0 && (
            <Section title={t('Spacecraft at {planet} now', { planet: name })}>
              <CraftCards t={t} items={p.there.craft.filter(c => c.page).map(c => ({ craft: c.page!, detail: c.cospar && /^\d{4}-/.test(c.cospar) ? t('launched {year}', { year: c.cospar.slice(0, 4) }) : null }))} />
              {unpaged.length > 0 && <p className="mt-3 text-[14px]">{t('Also there: {names}', { names: unpaged.map(c => c.name).join(', ') })}</p>}
            </Section>
          )}

          {p.sites.length > 0 && (
            <Section title={t('Where spacecraft have landed')}>
              <CraftCards t={t} items={p.sites.filter(s => s.craft).map(s => ({ craft: s.craft!, detail: [String(s.site.year), s.site.agency].join(' · ') }))} />
            </Section>
          )}

          {p.visits.length > 0 && (
            <Section title={t('Spacecraft that went there')}>
              <Visits t={t} visits={p.visits} planet={name} />
              <p className="mt-3 text-[13px] text-ink-3">{t('From the trajectories NASA JPL Horizons publishes, for the flights TAKIP has fetched.')}</p>
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
        <aside className="flex flex-col gap-10">
          {globe && (
            <Link href={localePath(text.locale, pagePath(globe))} className={cx('inline-flex items-center gap-2 text-[15px] font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>
              {t('{planet} in 3D', { planet: name })}<ArrowUpRight className="size-4" aria-hidden />
            </Link>
          )}
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      <section className="mt-20">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t('The other planets')}</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {PLANETS.filter(o => o.key !== p.planet.key).map(o => (
            <li key={o.key}>
              <Link href={localePath(text.locale, planetPath(o))} className={cx(LINK_BUTTON.secondary)}>{bodyName(t, o.key)}</Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
