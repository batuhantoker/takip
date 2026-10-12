import type { StateFeed } from './us-511';

/**
 * OSIRIS — camera sources with their own adapter. As with STATE_FEEDS, an entry here is the whole wiring:
 * route.ts registers the region and loads it for any view inside `bounds`.
 */
export const FEEDS: StateFeed[] = [];
