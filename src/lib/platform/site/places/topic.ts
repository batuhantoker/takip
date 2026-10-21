import type { Translate } from '@/lib/core/i18n/translator';
import type { EmbedSpec } from '@/lib/map/embed/spec';
import type { PanelLink, ViewModeLink } from '@/lib/map/view-mode-link';
import type { MapView } from '../map-link';
import type { Place, PlaceKind } from './place';

/**
 * A topic is what a place page is about: transit, cameras, hiking, earthquakes over a century. Each lives in two
 * files, because src/lib can't import components: this module in lib/platform/site/places/topics/<id>.ts, and
 * its body in components/site/places/topics/<id>-body.tsx. Both are listed in their folder's registry.
 *
 * Everything a page says has to be true of TAKIP's data, and specific to the place: a page that reads the same
 * for every city is the copy-paste that search engines mark the whole site down for.
 */
export interface PlaceTopic<D = unknown, L = unknown, X = unknown> {
  id: string;
  /** What the topic is called in the overview's links, as msg(). */
  label: string;
  /** Its name inside a sentence ("cameras", "ISS sightings"), as msg(): casing is the translation's to decide, not code's. */
  inline: string;
  kinds: readonly PlaceKind[];
  /**
   * The topic's pages for a place, with the data each renders; [] when there is nothing real to say. Must be cheap
   * and offline (read the topic's table): the sitemap and the "nearby" cards call it for thousands of places.
   */
  pages(place: Place): TopicPage<D>[];
  header(place: Place, page: TopicPage<D>, t: Translate): PlaceCopy;
  /** One line for the place's overview, naming what this page holds there. */
  summary(place: Place, page: TopicPage<D>, t: Translate): string;
  /** Where "Open the live map" lands. */
  open(place: Place, page: TopicPage<D>): MapLink;
  /** What is true right now, fetched when the page renders, over loopback (live/own-api.ts); null leaves it out. */
  live?(place: Place, page: TopicPage<D>, t: Translate): Promise<L | null>;
  /** What the topic's own page shows below its header from the network (a forecast), over loopback; never for the overview. */
  detail?(place: Place, page: TopicPage<D>, t: Translate): Promise<X | null>;
  /** The live box's heading on this topic's page, as msg() with {time}, where "Right now · as of {time}" isn't true. */
  liveLabel?: string;
  /** The header's map button, as msg(), where "Open the live map" isn't what it does. */
  openLabel?: string;
  /** A faith page (prayer times, Ramadan, Shabbat): reached from the place's Prayers page, never from lists of its topics. */
  faith?: true;
}

export interface TopicPage<D = unknown> {
  /** The URL segment, /city/<place>/<slug>. Unique among a place's pages. */
  slug: string;
  data: D;
  /** Enough real data to be worth a search result. A page below it still renders, with noindex, and stays out of the sitemap. */
  index: boolean;
  /** The page's name in the place's links, as msg(), where its topic has several pages; the topic's label otherwise. */
  label?: string;
  /** false keeps it out of the place's nav and overview, which list its topic's other pages; one of those stands for it. */
  listed?: false;
}

/** The <title> (up to 60 characters), meta description (110 to 160), heading and lede. */
export interface PlaceCopy { title: string; description: string; heading: string; lede: string }

export interface MapLink {
  /** Switched on, replacing the visitor's set; leave out to keep theirs (a History or Space page). */
  layers?: string[];
  /** Defaults to the place at `zoom`. */
  view?: MapView;
  zoom?: number;
  /** What the map and the header's live map follow, as `satellite:25544`. */
  track?: string;
  mode?: ViewModeLink;
  panel?: PanelLink;
  /** What the header's live map shows, when it isn't `layers` at the place: an area over a past window. */
  embed?: EmbedSpec;
}
