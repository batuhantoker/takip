import Link from 'next/link';
import { ArrowUpRight, History } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { LINK_BUTTON, Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { languageName } from '@/lib/core/wikipedia/language';
import { articleUrl } from '@/lib/core/wikipedia/refs';
import { AD_SLOTS } from '@/lib/platform/ads';
import type { EventArticle as Article } from '@/lib/platform/site/events/article';
import { localePath } from '@/lib/platform/site/locale-path';
import { craftOpenPath, craftReplayPath, type CraftPage } from '@/lib/platform/site/space/craft-page';
import { distanceText, launchDate } from '@/lib/platform/site/space/copy';
import { planetPath } from '@/lib/platform/site/space/planets';
import { KIND_LABEL } from '@/lib/platform/site/space/roster';
import type { SiteText } from '@/lib/platform/site/text';
import { REGION_LABEL } from '@/lib/space/craft/fleet';
import { latLng, lightTime, speed } from '@/lib/space/format';
import { CraftCards } from './parts/craft-cards';
import { FactRows, type FactRow } from './parts/fact-rows';
import { FlightTimeline } from './parts/flight-timeline';
import { NowBox } from './parts/now-box';
import { SpacePicture } from './parts/space-picture';

// Its mean radius; the bulge at the equator puts a craft's true height up to 21 km off.
const EARTH_RADIUS_KM = 6_371;

function NowLines({ t, page: p }: { t: Translate; page: CraftPage }) {
  if (p.rover) {
    return (
      <>
        {p.rover.sol !== null && <p className="font-semibold">{t('Sol {sol} on Mars', { sol: p.rover.sol.toLocaleString(t.intl) })}</p>}
        <p>{t('At {position}', { position: latLng(p.rover.lat, p.rover.lng) })}</p>
        {p.rover.driveKm !== null && <p>{t('Driven {km, distance} since landing', { km: p.rover.driveKm })}</p>}
        {p.now && <p className="mt-2 text-ink-2">{t('{distance} from Earth; a signal takes {light}', { distance: distanceText(t, p.now.earthKm), light: lightTime(p.now.lightSec, t) })}</p>}
      </>
    );
  }
  if (!p.now) return null;
  const n = p.now;
  if (p.site) return <p>{t('{distance} from Earth; a signal takes {light}', { distance: distanceText(t, n.earthKm), light: lightTime(n.lightSec, t) })}</p>;
  if (n.region === 'earth-orbit') {
    return (
      <>
        <p className="font-semibold">{t(REGION_LABEL[n.region])}</p>
        <p>{t('About {km, distance} above the Earth, moving at {speed}', { km: Math.max(0, n.earthKm - EARTH_RADIUS_KM), speed: speed(n.speedKmS, t) })}</p>
      </>
    );
  }
  return (
    <>
      <p className="font-semibold">{t(REGION_LABEL[n.region])}</p>
      <p>{t('{distance} from Earth; a signal takes {light}', { distance: distanceText(t, n.earthKm), light: lightTime(n.lightSec, t) })}</p>
      <p className="text-ink-2">
        {n.speedFrame === 'Sun'
          ? t('{distance} from the Sun, moving at {speed} relative to the Sun', { distance: distanceText(t, n.sunKm), speed: speed(n.speedKmS, t) })
          : t('{distance} from the Sun, moving at {speed} relative to {body}', { distance: distanceText(t, n.sunKm), speed: speed(n.speedKmS, t), body: t(n.speedFrame) })}
      </p>
    </>
  );
}

function facts(t: Translate, p: CraftPage): FactRow[] {
  const rows: FactRow[] = [{ label: t('What it is'), value: t(KIND_LABEL[p.craft.kind]) }];
  if (p.agency) rows.push({ label: t('Agency'), value: p.agency });
  if (p.launch) {
    rows.push({ label: t('Launched'), value: launchDate(t, p.launch.utc) });
    rows.push({ label: t('Rocket'), value: p.launch.vehicle });
    rows.push({ label: t('Launch site'), value: p.launch.pad });
  }
  if (p.site) {
    rows.push({ label: p.craft.site?.world === 'mars' ? t('Landed on Mars') : t('Landed on the Moon'), value: String(p.site.year) });
    rows.push({ label: t('Landing site'), value: `${p.site.name} · ${latLng(p.site.lat, p.site.lng)}` });
  }
  if (p.ended) rows.push({ label: t('Mission ended'), value: String(p.ended) });
  if (p.now?.cospar) rows.push({ label: t('International designator'), value: p.now.cospar });
  if (p.model) {
    rows.push({ label: t('3D model'), value: <a href={p.model.source} rel="noopener" className={TEXT_LINK}>{p.model.credit}</a> });
  }
  return rows;
}

/**
 * One spacecraft: what it is, where it is now (JPL Horizons, or NASA's rover maps), its flight as JPL's trajectory
 * has it, Wikipedia's summary, and the craft around it. A way into the space view, opened on this craft.
 */
export function CraftArticle({ text, page: p, article, shot }: { text: SiteText; page: CraftPage; article: Article | null; shot: string | null }) {
  const { t } = text;
  const open = craftOpenPath(p);
  const replay = craftReplayPath(p);
  const wikiHref = article?.url ?? articleUrl(p.craft.wiki);
  const wikipedia = !article || article.lang === 'en' ? 'Wikipedia' : t('{language} Wikipedia', { language: languageName(article.lang, t.intl) });
  const year = p.launch ? new Date(p.launch.utc).getUTCFullYear() : p.site?.year;
  const subline = [p.agency, year && t('launched {year}', { year: String(year) }), p.ended && t('ended {year}', { year: String(p.ended) })].filter(Boolean).join(' · ');
  const nowAt = p.rover?.at ?? p.now?.at;
  const planet = p.group === 'mars' ? { href: localePath(text.locale, planetPath({ key: 'mars' })), label: t('Mars right now') } : null;
  return (
    <article>
      <header className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <Link href={`${localePath(text.locale, '/spacecraft')}#${p.group}`} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>
            {t(KIND_LABEL[p.craft.kind])}
          </Link>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-5xl">{p.craft.name}</h1>
          {subline && <p className="mt-4 text-[14px] text-ink-3">{subline}</p>}
          {p.summary && <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{t(p.summary)}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={open} className={LINK_BUTTON.primary}>{t('Open in 3D')}<ArrowUpRight className="size-4" aria-hidden /></a>
            {replay && <a href={replay} className={LINK_BUTTON.secondary}><History className="size-4" aria-hidden />{t('Watch the flight')}</a>}
            <a href={wikiHref} rel="noopener" className={LINK_BUTTON.secondary}>{wikipedia}</a>
          </div>
          {nowAt !== undefined && (p.rover || p.now) && (
            <NowBox t={t} at={nowAt} className="mt-8"><NowLines t={t} page={p} /></NowBox>
          )}
        </div>
        <SpacePicture href={open} photo={article?.large ?? article?.image?.src ?? null} shot={shot} alt={p.craft.name} cta={t('Open in 3D')}
          credit={article?.image ? { label: t('Picture from {source}', { source: wikipedia }), href: wikiHref } : null} />
      </header>

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          {p.flight && p.flight.steps.length > 1 && (
            <Section title={t('The flight')}>
              <FlightTimeline t={t} flight={p.flight} />
              <p className="mt-4 text-[13px] text-ink-3">{t('From the trajectory NASA JPL Horizons publishes for it.')}</p>
            </Section>
          )}

          {article && (
            <Section title={article.title}>
              {article.description && <p className="text-[14px] text-ink-3">{article.description}</p>}
              <p className={article.description ? 'mt-3' : undefined}>{article.extract}</p>
              <p className="mt-3 text-[13px] text-ink-3">
                {t('From {source}, CC BY-SA', { source: wikipedia })}
                {' · '}<a href={article.url} rel="noopener" className={TEXT_LINK}>{t('Read the article')}</a>
              </p>
            </Section>
          )}

          <Section title={t('Facts')}>
            <FactRows rows={facts(t, p)} />
          </Section>
        </div>
        <aside className="flex flex-col gap-10">
          {planet && (
            <Link href={planet.href} className={cx('inline-flex items-center gap-2 text-[15px] font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>
              {planet.label}<ArrowUpRight className="size-4" aria-hidden />
            </Link>
          )}
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      {p.related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t('More spacecraft')}</h2>
          <div className="mt-5"><CraftCards t={t} items={p.related.map(craft => ({ craft }))} /></div>
          <p className="mt-4 text-[14px]">
            <Link href={localePath(text.locale, '/spacecraft')} className={TEXT_LINK}>{t('Every spacecraft')}</Link>
          </p>
        </section>
      )}
    </article>
  );
}
