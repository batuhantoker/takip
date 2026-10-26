import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Place } from '@/lib/platform/site/places/place';
import type { TopicPage } from '@/lib/platform/site/places/topic';
import type { SiteText } from '@/lib/platform/site/text';

export interface TopicViewProps<D> { text: SiteText; place: Place; page: TopicPage<D> }

/** A number a page leads with, in mono, and what it is. */
export interface Figure { value: string; label: string }

/**
 * How a topic's page renders: its body below the header, and the "right now" box when its lib module's live()
 * returned something. Server components; they get their text already in the reader's language through text.t.
 */
export interface TopicView<D, L = never, X = never> {
  icon: LucideIcon;
  /** `detail` is what the topic's detail() returned, null when it failed. */
  Body(props: TopicViewProps<D> & { detail?: X | null }): ReactNode;
  Live?(props: TopicViewProps<D> & { live: L }): ReactNode;
  /**
   * The page's figures, for its header; the place's overview leads with each listed page's first. From the page's data,
   * and its live() answer where one came back. Called, not mounted.
   */
  figures?(props: TopicViewProps<D> & { live?: L }): Figure[];
  /** Shown in the header instead of the live map, where something shows the topic better; null keeps the map. */
  Hero?(props: TopicViewProps<D>): ReactNode;
  /** In the header under the lede: the page's figures; null for none. */
  Lead?(props: TopicViewProps<D>): ReactNode;
  /** Across the page's whole width, between the header and the body's column. */
  Wide?(props: TopicViewProps<D> & { detail?: X | null }): ReactNode;
  /** Beside the body, above the ad. */
  Aside?(props: TopicViewProps<D>): ReactNode;
  /** Across the page's whole width, after the body. */
  Footer?(props: TopicViewProps<D>): ReactNode;
  /** On the place's overview, below its pages, for the listed page: the topic at a glance. */
  Overview?(props: TopicViewProps<D>): ReactNode;
  /** Its Overview goes above the list of the place's pages rather than below it. */
  overviewFirst?: true;
  /** The "nearby" cards on this topic's page say what the topic holds in each place (its summary()), not its other topics. */
  nearbySummary?: true;
  /** On a wide screen the live map leaves the header for the body's side column and stays in view beside its rows. */
  mapBeside?: true;
}
