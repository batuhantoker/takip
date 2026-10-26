import type { ReactNode } from 'react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { cx } from '@/components/ui/class-names';
import { Section } from '@/components/site/pages/site-frame';
import { embedHref } from '@/lib/map/embed/spec';
import { AD_SLOTS } from '@/lib/platform/ads';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { nameOf, shortHeading } from '@/lib/platform/site/places/copy/format';
import { countryMap } from '@/lib/platform/site/places/country-live';
import type { PlacePageRef } from '@/lib/platform/site/places/pages';
import type { Place } from '@/lib/platform/site/places/place';
import { placeOpenPath, placePath, placeZoom } from '@/lib/platform/site/places/paths';
import type { MapLink, PlaceCopy } from '@/lib/platform/site/places/topic';
import type { SiteText } from '@/lib/platform/site/text';
import { CountryLive } from './parts/country-live';
import { Figures, type PageFigure } from './parts/figures';
import { LiveBox } from './parts/live-box';
import { PlaceHeader, PlaceMap } from './parts/place-header';
import { listedPages, NearbyList, PageList, PlaceList, TopicNav } from './parts/place-links';
import { TOPIC_VIEWS } from './topics/registry';

/** A live answer, by the page it belongs to. */
export interface PageLive { ref: PlacePageRef; live: unknown; at: number }

/** The overview leads with one figure from each of these, in this order: what is moving now, then what the lede counts. */
const FIGURE_ORDER = ['transit', 'weather', 'ports', 'sun', 'attractions', 'cameras', 'hiking'];
const MAX_FIGURES = 4;

/**
 * A place's page: its overview (no `current`), or one topic page. Its tabs, header and "right now" are shared; below
 * them, the overview lists the place's pages and a topic page renders its own body, beside the live map where the
 * topic lists places, in one column otherwise. Nearby places close it.
 */
export function PlaceArticle({ text, place, copy, pages, places = [], current, lives, detail, image, nearby }: {
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
}) {
  const { t } = text;
  const listed = listedPages(pages);
  // The overview's list and map leave out faith pages, which the nav's Prayers entry leads to.
  const browse = listed.filter(p => !p.topic.faith);
  const leading = [...browse.filter(p => p.topic.leadsOverviewMap), ...browse.filter(p => !p.topic.leadsOverviewMap)];
  const link: MapLink = current ? current.topic.open(place, current.page)
    : place.kind === 'country' ? countryMap(place) : { layers: [...new Set(leading.flatMap(p => p.topic.open(place, p.page).layers ?? []))].slice(0, 4) };
  const open = placeOpenPath(place, link);
  const focus = { lat: place.at[1], lon: place.at[0], zoom: placeZoom(place, link.zoom) };
  // Following something away from the place, the map keeps it marked.
  const pin = link.track ? { lat: focus.lat, lon: focus.lon, name: nameOf(place, t) } : undefined;
  const embed = embedHref(link.embed ?? { layers: link.layers ?? [], view: focus, track: link.track, pin });
  const shown = lives.flatMap(({ ref, live, at }) => {
    const Live = TOPIC_VIEWS[ref.topic.id]?.Live;
    // The overview gives each topic one line: the first of a list (the nearest station); its figures read the whole.
    const said = !current && Array.isArray(live) ? live.slice(0, 1) : live;
    const node: ReactNode = Live ? <Live key={ref.page.slug} text={text} place={place} page={ref.page} live={said} /> : null;
    return node ? [{ node, at }] : [];
  });
  const liveOf = new Map(lives.map(l => [l.ref.page.slug, l.live]));
  const figuresOf = (ref: PlacePageRef) => TOPIC_VIEWS[ref.topic.id]?.figures?.({ text, place, page: ref.page, live: liveOf.get(ref.page.slug) }) ?? [];
  const figures: PageFigure[] = current
    ? figuresOf(current).slice(0, MAX_FIGURES)
    : FIGURE_ORDER.flatMap(id => browse.filter(p => p.topic.id === id).slice(0, 1))
      .flatMap(p => figuresOf(p).slice(0, 1).map(f => ({ ...f, href: localePath(t.locale, placePath(place, p.page.slug)) })))
      .slice(0, MAX_FIGURES);
  const view = current && TOPIC_VIEWS[current.topic.id];
  const Body = view?.Body;
  const Wide = view?.Wide;
  const Aside = view?.Aside;
  // Called rather than mounted, so one that has nothing to show leaves the live map and the spacing as they were.
  const hero = current && view?.Hero?.({ text, place, page: current.page });
  const facts = current && view?.Lead?.({ text, place, page: current.page });
  const Footer = view?.Footer;
  const beside = !!(current && view?.mapBeside);
  // A side column only for something real in it; the ad alone never holds one.
  const side = beside || !!(current && Aside);
  // A header with its own hero (camera pictures) keeps the width; the map then starts beside the body.
  const inColumn = beside && !hero;
  const wide = Wide && current ? <Wide text={text} place={place} page={current.page} detail={detail} /> : null;
  const openLabel = current?.topic.openLabel;
  const overviews = (first: boolean) => browse.map(p => {
    const v = TOPIC_VIEWS[p.topic.id];
    return v?.Overview && !!v.overviewFirst === first ? <v.Overview key={p.page.slug} text={text} place={place} page={p.page} /> : null;
  });
  const ad = <AdSlot slot={AD_SLOTS.page} variant="page" className={side ? '' : 'mt-14 block'} />;

  const body = (
    // Prose keeps a reading measure; lists and pictures take the width.
    <div className={side ? undefined : '[&_p]:max-w-[46rem]'}>
      {/* Beside the map, so what it shows can mark it from the first screen. */}
      {beside && wide}
      {!current && place.kind === 'country' && <CountryLive text={text} place={place} />}
      {!current && overviews(true)}
      {!current && browse.length > 0 && (
        <Section title={t('{city} on the map', { city: nameOf(place, t) })}>
          <PageList items={browse.map(p => ({
            href: localePath(t.locale, placePath(place, p.page.slug)), rel: crawlRel(p.page.index),
            title: shortHeading(p.topic.header(place, p.page, t).heading, place, t), line: p.topic.summary(place, p.page, t),
          }))} />
        </Section>
      )}
      {!current && overviews(false)}
      {Body && current && <Body text={text} place={place} page={current.page} detail={detail} />}
      {places.length > 0 && (
        <Section title={t('Places in {country}', { country: nameOf(place, t) })}>
          <PlaceList text={text} places={places} />
        </Section>
      )}
    </div>
  );

  const header = (
    <PlaceHeader t={t} heading={copy.heading} lede={copy.lede} open={open} embed={embed} image={image} focus={focus}
      figures={figures.length ? <Figures figures={figures} /> : undefined}
      live={shown.length ? <LiveBox t={t} at={Math.min(...shown.map(s => s.at))} label={current?.topic.liveLabel}>{shown.map(s => s.node)}</LiveBox> : undefined}
      hero={hero ?? undefined} openLabel={openLabel && t(openLabel)} facts={facts ?? undefined} mapBeside={beside} />
  );

  return (
    <article>
      {listed.length > 1 && <TopicNav text={text} place={place} pages={pages} current={current?.page.slug} />}
      {!inColumn && header}

      {wide && !beside && <div className="mt-14">{wide}</div>}
      {side ? (
        // Beside the map, the header heads the column, so the map starts under the tabs.
        <div className={cx('grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16', !inColumn && 'mt-14')}>
          {inColumn ? <div>{header}<div className="mt-14">{body}</div></div> : body}
          <aside className={cx('flex flex-col gap-10', inColumn && 'lg:pt-10')}>
            {beside && (
              // Fills the column down to the ad, so the map stays in view beside the whole list.
              <div className="hidden flex-1 lg:block">
                <div className="sticky top-14">
                  <PlaceMap t={t} heading={copy.heading} open={open} embed={embed} focus={focus} image={image} live={shown.length > 0} mode="beside" />
                </div>
              </div>
            )}
            {Aside && current && <Aside text={text} place={place} page={current.page} />}
            {ad}
          </aside>
        </div>
      ) : (
        <>
          <div className="mt-14">{body}</div>
          {ad}
        </>
      )}
      {Footer && current && <div className="mt-16"><Footer text={text} place={place} page={current.page} /></div>}

      {nearby.length > 0 && (
        <Section tier="about" title={t('Other places nearby')}>
          <NearbyList text={text} places={nearby} from={place} page={current?.page.slug} summary={!!view?.nearbySummary} />
        </Section>
      )}
    </article>
  );
}
