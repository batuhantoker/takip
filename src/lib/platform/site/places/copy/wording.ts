// No imports: the forecast that uses this also renders in the browser, where the gazetteer's file reads can't go.

/** One of `n` wordings for `key`, fixed for a page and different from its neighbours', so 30,000 pages don't read alike. */
export function wordingFor(key: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) % n;
}
