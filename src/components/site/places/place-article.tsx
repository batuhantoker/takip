import type { ReactNode } from 'react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { Section } from '@/components/site/pages/site-frame';
import { embedHref } from '@/lib/map/embed/spec';
import { AD_SLOTS } from '@/lib/platform/ads';
import { localePath } from '@/lib/platform/site/locale-path';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { countryMap } from '@/lib/platform/site/places/country-live';
import type { PlacePageRef } from '@/lib/platform/site/places/pages';
import type { Place } from '@/lib/platform/site/places/place';
import { placeOpenPath, placePath, placeZoom } from '@/lib/platform/site/places/paths';
import type { MapLink, PlaceCopy } from '@/lib/platform/site/places/topic';
import type { SiteText } from '@/lib/platform/site/text';
import { CountryLive } from './parts/country-live';
import { LiveBox } from './parts/live-box';
import { PlaceHeader } from './parts/place-header';
import { LinkCard, listedPages, PlaceCards, PlaceList, TopicNav } from './parts/place-links';
import { TOPIC_VIEWS } from './topics/registry';

/** A live answer, by the page it belongs to. */
export interface PageLive { ref: PlacePageRef; live: unknown; at: number }

/**
 * A place's page: its overview (no `current`), or one topic page. The header and the "right now" box are shared;
 * below them, the overview lists the place's pages and a topic page renders its own body.
 */
export function PlaceArticle({ text, place, copy, pages, places = [], current, lives, detail, image, nearby, kicker }: {
  text: SiteText;
  place: Place;
  copy: PlaceCopy;
  pages: PlacePageRef[];
  /** A country's places with pages. */
  places?: Place[];
  current?: PlacePageRef;
  lives: PageLive[];
  /** The current page's topic detail(). */
  detail?: unknown;
  image: string | null;
  nearby: Place[];
  kicker: { href: string; label: string };
}) {
  const { t } = text;
  const listed = listedPages(pages);
  // The overview's cards and map leave out faith pages, which the nav's Prayers entry leads to.
  const browse = listed.filter(p => !p.topic.faith);
  const link: MapLink = current ? current.topic.open(place, current.page)
    : place.kind === 'country' ? countryMap(place) : { layers: browse.flatMap(p => p.topic.open(place, p.page).layers ?? []).slice(0, 4) };
  const open = placeOpenPath(place, link);
  const focus = { lat: place.at[1], lon: place.at[0], zoom: placeZoom(place, link.zoom) };
  // Following something away from the place, the map keeps it marked.
  const pin = link.track ? { lat: focus.lat, lon: focus.lon, name: nameOf(place, t) } : undefined;
  const embed = embedHref(link.embed ?? { layers: link.layers ?? [], view: focus, track: link.track, pin });
  const shown = lives.flatMap(({ ref, live, at }) => {
    const Live = TOPIC_VIEWS[ref.topic.id]?.Live;
    const node: ReactNode = Live ? <Live key={ref.page.slug} text={text} place={place} page={ref.page} live={live} /> : null;
    return node ? [{ node, at }] : [];
  });
  const view = current && TOPIC_VIEWS[current.topic.id];
  const Body = view?.Body;
  const Hero = view?.Hero;
  const Wide = view?.Wide;
  const Lead = view?.Lead;
  const Aside = view?.Aside;
  const Footer = view?.Footer;
  const openLabel = current?.topic.openLabel;

  return (
    <article>
      <PlaceHeader t={t} kicker={kicker} heading={copy.heading} lede={copy.lede} open={open} embed={embed} image={image} focus={focus}
        live={shown.length ? <LiveBox t={t} at={Math.min(...shown.map(s => s.at))} label={current?.topic.liveLabel}>{shown.map(s => s.node)}</LiveBox> : undefined}
        hero={Hero && current ? <Hero text={text} place={place} page={current.page} /> : undefined} openLabel={openLabel && t(openLabel)}
        facts={Lead && current ? <Lead text={text} place={place} page={current.page} /> : undefined} />
      {listed.length > 1 && <TopicNav text={text} place={place} pages={pages} current={current?.page.slug} />}

      {Wide && current && <div className="mt-16"><Wide text={text} place={place} page={current.page} detail={detail} /></div>}
      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          {!current && place.kind === 'country' && <CountryLive text={text} place={place} />}
          {!current && browse.length > 0 && (
            <Section title={t('{city} on the map', { city: nameOf(place, t) })}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {browse.map(p => (
                  <li key={p.page.slug}>
                    <LinkCard href={localePath(t.locale, placePath(place, p.page.slug))} title={p.topic.header(place, p.page, t).heading}
                      line={p.topic.summary(place, p.page, t)} Icon={TOPIC_VIEWS[p.topic.id]?.icon} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {!current && browse.map(p => {
            const Overview = TOPIC_VIEWS[p.topic.id]?.Overview;
            return Overview ? <Overview key={p.page.slug} text={text} place={place} page={p.page} /> : null;
          })}
          {Body && current && <Body text={text} place={place} page={current.page} detail={detail} />}
          {places.length > 0 && (
            <Section title={t('Places in {country}', { country: nameOf(place, t) })}>
              <PlaceList text={text} places={places} />
            </Section>
          )}
        </div>
        <aside className="flex flex-col gap-10">
          {Aside && current && <Aside text={text} place={place} page={current.page} />}
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>
      {Footer && current && <div className="mt-16"><Footer text={text} place={place} page={current.page} /></div>}

      {nearby.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t('Other places nearby')}</h2>
          <div className="mt-5"><PlaceCards text={text} places={nearby} page={current?.page.slug} /></div>
        </section>
      )}
    </article>
  );
}
