import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pictures of the map for the public pages, one per page, made by tools/site/shots.ts against a running
 * server. They live outside git (.cache) so retaking them doesn't grow the repository.
 */
export const SHOTS_DIR = process.env.SITE_SHOTS_DIR || join(process.cwd(), '.cache', 'site-shots');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const shotFile = (slug: string) => (SLUG.test(slug) ? join(SHOTS_DIR, `${slug}.jpg`) : null);

/** The picture's URL, with its age in it so a retake isn't served stale; null when there is none yet. */
export function shotUrl(slug: string): string | null {
  const file = shotFile(slug);
  if (!file || !existsSync(file)) return null;
  return `/shots/${slug}.jpg?v=${Math.floor(statSync(file).mtimeMs / 1000)}`;
}
