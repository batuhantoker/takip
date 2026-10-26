import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { MapWindow } from '@/components/site/pages/map-window';
import { LINK_BUTTON, Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { PlaceMap } from '@/components/site/places/parts/place-header';
import { CameraFrames } from '@/components/site/places/topics/parts/camera-frames';
import { WeatherForecast } from '@/components/site/places/topics/parts/weather-forecast';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { languageName } from '@/lib/core/wikipedia/language';
import { leadSentences } from '@/lib/core/wikipedia/summary';
import { AD_SLOTS } from '@/lib/platform/ads';
import { embedHref } from '@/lib/map/embed/spec';
import type { EventArticle as Article } from '@/lib/platform/site/events/article';
import { eventPath } from '@/lib/platform/site/events/sitemap';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { countryName, feetFirst, heightShort, kindLabel, placeLabel, topsOf } from '@/lib/platform/site/mountains/copy';
import { mountainMapPath, type MountainPage } from '@/lib/platform/site/mountains/mountain-page';
import { mountainsPath } from '@/lib/platform/site/mountains/sitemap';
import { placeLabel as townLabel } from '@/lib/platform/site/places/gazetteer';
import { placePath } from '@/lib/platform/site/places/paths';
import type { CityForecast } from '@/lib/platform/site/places/topics/weather-forecast';
import type { SiteText } from '@/lib/platform/site/text';
import { MountainFacts } from './parts/mountain-facts';
import { PeakRows } from './parts/peak-rows';
import { SummitNow } from './parts/summit-now';

// The opening the header shows, in characters: a few sentences, fewer in Chinese and Japanese.
const LEAD = 320;
const LEAD_CJK = 130;
const CJK = new Set(['zh', 'ja']);
/** Close enough to see the summit and the valleys around it. */
const EMBED_ZOOM = 11;

/** A Commons file at a width Wikimedia keeps scaled copies at. */
const commonsThumb = (file: string, px: number) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${px}`;

/**
 * One mountain: how high it is and what it looks like on the first screen, then the weather at its summit, its
 * facts, and every way on: the peaks around it, its range and country's highest, its eruptions and history, the
 * towns and cameras near it, each row marking the live map beside the list.
 */
export function MountainArticle({ text, page, name, article, forecast, coords }: {
  text: SiteText;
  page: MountainPage;
  name: string;
  article: Article | null;
  forecast: CityForecast | null;
  coords: string;
}) {
  const { t } = text;
  const m = page.mountain;
  const feet = feetFirst(m);
  const open = mountainMapPath(m);
  const embed = localePath(t.locale, embedHref({ layers: ['hiking_routes'], view: { lat: m.lat, lon: m.lon, zoom: EMBED_ZOOM }, pin: { lat: m.lat, lon: m.lon, name } }));
  const focus = { lat: m.lat, lon: m.lon, zoom: EMBED_ZOOM };
  const wikipedia = !article || article.lang === 'en' ? 'Wikipedia' : t('{language} Wikipedia', { language: languageName(article.lang, t.intl) });
  const extract = article?.extract.trim() || null;
  const lead = extract && leadSentences(extract, CJK.has(article!.lang) ? LEAD_CJK : LEAD);
  const photo = article?.large ?? article?.image?.src ?? (m.image ? commonsThumb(m.image, 960) : null);
  const photoCredit = article?.image
    ? { label: t('Picture from {source}', { source: wikipedia }), href: article.url }
    : m.image ? { label: t('Picture from Wikimedia Commons'), href: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(m.image.replace(/ /g, '_'))}` } : null;
  const range = m.range !== null ? placeLabel(t, page.places.get(m.range)) : null;
  const country = m.cc[0];
  const tops = topsOf(t, m, page.places);
  const subline = [kindLabel(t, m), range, ...m.cc.map(cc => countryName(t, cc))].filter(Boolean).join(' · ');
  const elevation = m.elev !== null ? heightShort(t, m.elev, feet) : null;
  const other = m.elev !== null ? heightShort(t, m.elev, !feet) : null;
  // The page's own peak takes its place among its country's highest when it is one of them.
  const withSelf = m.elev !== null ? [...page.countryPeaks, m].sort((a, b) => (b.elev ?? 0) - (a.elev ?? 0)).slice(0, 10) : page.countryPeaks;
  const frames = page.cameras.map(({ item: c, km }) => ({
    key: `${c.lat},${c.lng}`, name: c.name, src: c.frame!, href: `/?lat=${c.lat.toFixed(5)}&lon=${c.lng.toFixed(5)}&zoom=15&layers=cctv`,
    meta: t('{km, distance} from the summit', { km }),
  }));
  return (
    <article>
      <header className="mt-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <Link href={localePath(t.locale, mountainsPath(country))} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>
            {country ? t('Mountains in {country}', { country: countryName(t, country) }) : t('Mountains')}
          </Link>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-5xl">{name}</h1>
          {elevation && (
            <p className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-semibold tracking-[-0.01em] text-ink-1 tabular-nums">{elevation}</span>
              <span className="text-[15px] text-ink-3 tabular-nums">{other}</span>
            </p>
          )}
          <p className="mt-2 text-[14px] text-ink-3">{subline}</p>
          {lead && <p className="mt-4 text-[17px] leading-relaxed text-ink-1">{lead}</p>}
          {lead && article && (
            <p className="mt-2 text-[12px] text-ink-3">
              {t('From {source}, CC BY-SA', { source: wikipedia })}{' · '}<a href={article.url} rel="noopener" className={TEXT_LINK}>{t('Read the article')}</a>
            </p>
          )}
          {tops.length > 0 && <p className="mt-4 text-[15px] font-medium text-ink-1">{t('The highest point of {places}', { places: new Intl.ListFormat(t.intl, { type: 'conjunction' }).format(tops) })}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={open} className={LINK_BUTTON.primary}>{t('See it in 3D')}<ArrowUpRight className="size-4" aria-hidden /></a>
            {article && <a href={article.url} rel="noopener" className={LINK_BUTTON.secondary}>{wikipedia}</a>}
          </div>
          {forecast && <SummitNow t={t} forecast={forecast} cc={country ?? ''} className="mt-8" />}
        </div>
        {photo
          ? (
            <figure>
              <a href={open} aria-label={`${t('See it in 3D')}: ${name}`} className={cx('group relative block aspect-[4/3] overflow-hidden rounded-float border border-line bg-surface-1 shadow-float', FOCUS_RING)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia's own scaled copy; next/image has no remote patterns here. */}
                <img src={photo} alt={name} fetchPriority="high" decoding="async" className="size-full object-cover transition-opacity duration-150 ease-out group-hover:opacity-90 motion-reduce:transition-none" />
                <span className="absolute right-3 bottom-3 inline-flex h-9 items-center gap-1.5 rounded-control bg-accent px-3.5 text-body font-medium text-on-accent">
                  {t('See it in 3D')}<ArrowUpRight className="size-4" aria-hidden />
                </span>
              </a>
              {photoCredit && <figcaption className="mt-2 text-[12px] text-ink-3"><a href={photoCredit.href} rel="noopener" className="hover:text-ink-1">{photoCredit.label}</a></figcaption>}
            </figure>
          )
          : <MapWindow href={open} image={null} alt={name} cta={t('See it in 3D')} focus={{ ...focus, zoom: 6 }} priority />}
      </header>

      <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          {forecast && (
            <WeatherForecast t={t} city="" cc={country ?? ''} forecast={forecast}
              title={m.elev !== null ? t('Weather at the summit of {name}, {height}', { name, height: elevation! }) : t('{city} weather forecast', { city: name })} />
          )}

          <Section title={t('Facts')}>
            <MountainFacts text={text} page={page} coords={coords} />
          </Section>

          {article && extract && lead !== extract && (
            <Section title={article.title}>
              {article.description && <p className="text-[14px] text-ink-3">{article.description}</p>}
              <p className={article.description ? 'mt-3' : undefined}>{extract}</p>
              <p className="mt-3 text-[13px] text-ink-3">
                {t('From {source}, CC BY-SA', { source: wikipedia })}{' · '}<a href={article.url} rel="noopener" className={TEXT_LINK}>{t('Read the article')}</a>
              </p>
            </Section>
          )}

          <div className="mt-12 lg:hidden">
            <PlaceMap t={t} heading={name} open={open} embed={embed} focus={focus} image={null} live={false} mode="phone" />
          </div>

          {page.eruptions.length > 0 && (
            <Section title={t('{n, plural, one {# recorded eruption} other {# recorded eruptions}}', { n: page.eruptionTotal })}>
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {page.eruptions.map(e => (
                  <li key={e.slug} className="border-b border-line py-2 last:border-0">
                    <Link href={localePath(t.locale, eventPath(e.slug))} rel={crawlRel(e.indexed)} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>
                      {t('Eruption in {year}', { year: e.year < 1 ? t('{year} BCE', { year: 1 - e.year }) : String(e.year) })}
                    </Link>
                  </li>
                ))}
              </ul>
              {page.eruptionTotal > page.eruptions.length && (
                <p className="mt-3 text-[13px] text-ink-3">{t('The latest {shown} of {n}, from the Smithsonian’s Global Volcanism Program through History.', { shown: page.eruptions.length, n: page.eruptionTotal })}</p>
              )}
            </Section>
          )}

          {page.nearby.length > 0 && (
            <Section title={t('Peaks near {name}', { name })}>
              <PeakRows t={t} feet={feet} columns peaks={page.nearby.map(n => ({ mountain: n.item, km: n.km }))} />
            </Section>
          )}

          {page.parent && (
            <Section title={t('Parent peak')}>
              <p className="mb-2 text-[14px] text-ink-3">{t('The nearest higher peak its prominence is measured to.')}</p>
              <PeakRows t={t} feet={feet} peaks={[{ mountain: page.parent }]} />
            </Section>
          )}

          {page.children.length > 0 && (
            <Section title={t('Peaks below {name}', { name })}>
              <PeakRows t={t} feet={feet} columns peaks={page.children.map(mountain => ({ mountain }))} />
            </Section>
          )}

          {range && page.rangePeaks.length > 0 && (
            <Section title={t('Highest in the {range}', { range })}>
              <PeakRows t={t} feet={feet} columns current={m.qid}
                peaks={[...page.rangePeaks, m].filter(p => p.elev !== null).sort((a, b) => b.elev! - a.elev!).slice(0, 9).map(mountain => ({ mountain }))} />
            </Section>
          )}

          {country && withSelf.length > 1 && (
            <Section title={t('Highest mountains in {country}', { country: countryName(t, country) })}>
              <PeakRows t={t} feet={feet} columns current={m.qid} peaks={withSelf.map(mountain => ({ mountain }))} />
              <p className="mt-4 text-[14px]">
                <Link href={localePath(t.locale, mountainsPath(country))} className={TEXT_LINK}>{t('Every mountain in {country}', { country: countryName(t, country) })}</Link>
              </p>
            </Section>
          )}

          {frames.length > 0 && (
            <Section title={t('Webcams near {name}', { name })}>
              <CameraFrames frames={frames} show={4} empty={t('None of these cameras is sending a picture right now.')} eager={false} />
            </Section>
          )}

          {page.history.length > 0 && (
            <Section title={t('History around {name}', { name })}>
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {page.history.map(e => (
                  <li key={e.slug} className="border-b border-line py-2 last:border-0">
                    <Link href={localePath(t.locale, eventPath(e.slug))} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>{e.title ?? e.slug}</Link>
                    <span className="ml-2 text-[13px] text-ink-3 tabular-nums">{e.year < 1 ? t('{year} BCE', { year: 1 - e.year }) : e.year}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {page.towns.length > 0 && (
            <Section title={t('Towns near {name}', { name })}>
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {page.towns.map(({ item: p, km }) => (
                  <li key={p.id} data-map={`${p.at[0]},${p.at[1]}`} data-map-id={`g${p.id}`} data-map-label={townLabel(p, t.locale)}
                    className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0">
                    <Link href={localePath(t.locale, placePath(p))} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>{townLabel(p, t.locale)}</Link>
                    <span className="text-[13px] text-ink-3 tabular-nums">{t('{km, distance} away', { km })}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
        <aside className="flex flex-col gap-10">
          <div className="hidden flex-1 lg:block">
            <div className="sticky top-14">
              <PlaceMap t={t} heading={name} open={open} embed={embed} focus={focus} image={null} live={false} mode="beside" />
            </div>
          </div>
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>
    </article>
  );
}
