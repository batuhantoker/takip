/**
 * A comparison's address without reading any data, for src/proxy.ts: /compare/<a>-vs-<b>[/<measure>], the two
 * country slugs in alphabetical order (pairs.ts pairSlug), so every pair has one URL and the other spelling
 * redirects to it.
 */

const PAIR = /^\/compare\/([a-z0-9-]+?)-vs-([a-z0-9-]+)(\/[a-z0-9-]+)?$/;

/** The canonical path for a comparison path whose countries are named the other way round; null otherwise. */
export function reversedPairPath(path: string): string | null {
  const m = PAIR.exec(path);
  if (!m || m[2].includes('-vs-')) return null;
  const [, a, b, rest = ''] = m;
  return a > b ? `/compare/${b}-vs-${a}${rest}` : null;
}
