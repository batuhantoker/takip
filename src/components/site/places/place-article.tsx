import type { ReactNode } from 'react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { Section } from '@/components/site/pages/site-frame';
import { AD_SLOTS } from '@/lib/platform/ads';
import { localePath } from '@/lib/platform/site/locale-path';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import type { PlacePageRef } from '@/lib/platform/site/places/pages';
import type { Place } from '@/lib/platform/site/places/place';
import { placeOpenPath, placePath, placeZoom } from '@/lib/platform/site/places/paths';
import type { PlaceCopy } from '@/lib/platform/site/places/topic';
import type { SiteText } from '@/lib/platform/site/text';
import { LiveBox } from './parts/live-box';
import { PlaceHeader } from './parts/place-header';
import { LinkCard, PlaceCards, PlaceList, TopicNav } from './parts/place-links';
import { TOPIC_VIEWS } from './topics/registry';

/** A live answer, by the page it belongs to. */
export interface PageLive { ref: PlacePageRef; live: unknown; at: number }

/**
 * A place's page: its overview (no `current`), or one topic page. The header and the "right now" box are shared;
 * below them, the overview lists the place's pages and a topic page renders its own body.
 */
export function PlaceArticle({ text, place, copy, pages, places = [], current, lives, image, nearby, kicker }: {
  text: SiteText;
  place: Place;
  copy: PlaceCopy;
  pages: PlacePageRef[];
  /** A country's places with pages. */
  places?: Place[];
  current?: PlacePageRef;
  lives: PageLive[];
  image: string | null;
  nearby: Place[];
  kicker: { href: string; label: string };
}) {
  const { t } = text;
  const link = current ? current.topic.open(place, current.page) : { layers: pages.flatMap(p => p.topic.open(place, p.page).layers ?? []).slice(0, 4) };
  const open = placeOpenPath(place, link);
  const shown = lives.flatMap(({ ref, live, at }) => {
    const Live = TOPIC_VIEWS[ref.topic.id]?.Live;
    const node: ReactNode = Live ? <Live key={ref.page.slug} text={text} place={place} page={ref.page} live={live} /> : null;
    return node ? [{ node, at }] : [];
  });
  const view = current && TOPIC_VIEWS[current.topic.id];
  const Body = view?.Body;

  return (
    <article>
      <PlaceHeader t={t} kicker={kicker} heading={copy.heading} lede={copy.lede} open={open} image={image}
        focus={{ lat: place.at[1], lon: place.at[0], zoom: placeZoom(place, link.zoom) }}
        live={shown.length ? <LiveBox t={t} at={Math.min(...shown.map(s => s.at))}>{shown.map(s => s.node)}</LiveBox> : undefined} />
      {pages.length > 1 && <TopicNav text={text} place={place} pages={pages} current={current?.page.slug} />}

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          {!current && pages.length > 0 && (
            <Section title={t('{city} on the map', { city: nameOf(place, t) })}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {pages.map(p => (
                  <li key={p.page.slug}>
                    <LinkCard href={localePath(t.locale, placePath(place, p.page.slug))} title={p.topic.header(place, p.page, t).heading}
                      line={p.topic.summary(place, p.page, t)} Icon={TOPIC_VIEWS[p.topic.id]?.icon} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {Body && current && <Body text={text} place={place} page={current.page} />}
          {places.length > 0 && (
            <Section title={t('Places in {country}', { country: nameOf(place, t) })}>
              <PlaceList text={text} places={places} />
            </Section>
          )}
        </div>
        <aside className="flex flex-col gap-10">
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      {nearby.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t('Other places nearby')}</h2>
          <div className="mt-5"><PlaceCards text={text} places={nearby} page={current?.page.slug} /></div>
        </section>
      )}
    </article>
  );
}
