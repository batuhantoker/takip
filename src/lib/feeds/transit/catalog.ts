import { EXTRA_FEEDS } from './sources/extra-feeds';
import { GTFS_RT_FEEDS } from './generated/feeds.generated';
import { SCHEDULED_FEEDS } from './generated/schedules.generated';
import type { TransitFeed } from './select';

/** Server-only: the client never sees feed URLs, and /api/transit only fetches what is listed here. */
export const TRANSIT_FEEDS: readonly TransitFeed[] = [...GTFS_RT_FEEDS, ...EXTRA_FEEDS, ...SCHEDULED_FEEDS];
