import { dbStamp, readDb } from '@/lib/core/read-db';

/* Read-only handles on data/db/event-pages.db (the slug index, tools/site/build-event-pages.ts) and history.db. */

/** The slug index, or null where it hasn't been built. */
export const pagesDb = () => readDb('event-pages.db');

export const historyDb = () => readDb('history.db');

/** Changes whenever either file is replaced, for caches keyed on what they read. */
export const buildStamp = (): string => `${dbStamp('event-pages.db')}|${dbStamp('history.db')}`;
