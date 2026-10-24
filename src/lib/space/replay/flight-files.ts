import { join } from 'path';

/**
 * TAKIP — where fetched flights are kept on disk, one JSON file per craft. The history route writes them
 * (app/api/(space)/space/history/store.ts); the public spacecraft pages read them.
 */

/** Bump when the `CraftHistory` shape changes; files of older versions are then ignored. */
export const HISTORY_VERSION = 7;

export const historyDir = () => join(process.env.TAKIP_SPACE_HISTORY_DIR || join(process.cwd(), '.cache', 'space-history'), `v${HISTORY_VERSION}`);

export const historyFile = (id: number) => join(historyDir(), `${id}.json`);
