import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Place } from '@/lib/platform/site/places/place';
import type { TopicPage } from '@/lib/platform/site/places/topic';
import type { SiteText } from '@/lib/platform/site/text';

export interface TopicViewProps<D> { text: SiteText; place: Place; page: TopicPage<D> }

/**
 * How a topic's page renders: its body below the header, and the "right now" box when its lib module's live()
 * returned something. Server components; they get their text already in the reader's language through text.t.
 */
export interface TopicView<D, L = never> {
  icon: LucideIcon;
  Body(props: TopicViewProps<D>): ReactNode;
  Live?(props: TopicViewProps<D> & { live: L }): ReactNode;
  /** Shown in the header instead of the live map, which can't show this topic. */
  Hero?(props: TopicViewProps<D>): ReactNode;
  /** On the place's overview, below its pages, for the listed page: the topic at a glance. */
  Overview?(props: TopicViewProps<D>): ReactNode;
}
