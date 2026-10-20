import { createHash } from 'node:crypto';

/**
 * Event page addresses, /event/<slug>: the title folded to ASCII, then the start year ("battle-of-gallipoli-1915",
 * "battle-of-marathon-490-bce"). The year is left off when the title already starts or ends with it ("1999-izmit-earthquake").
 * Where two events share that base, the one already holding it keeps it and the other gets a suffix from its own
 * source and record id. tools/site/build-event-pages.ts assigns them and keeps every slug it has handed out.
 */

const MAX_WORDS_LENGTH = 72;

/** The stable identity of an event across imports: its source's code and the source's own record id. */
export const eventKey = (sourceCode: string, recordId: string) => `${sourceCode}:${recordId}`;

/** A year as a slug part: 1915, 378, 490-bce. Years count astronomically (0 is 1 BCE), as Date does. */
export function yearPart(year: number): string {
  return year > 0 ? String(year) : `${1 - year}-bce`;
}

/** Lowercase ASCII words joined by hyphens; letters with accents lose them, other scripts drop out. */
export function slugWords(text: string): string {
  const folded = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ßẞ]/g, 'ss').replace(/[æÆ]/g, 'ae').replace(/[œŒ]/g, 'oe').replace(/[øØ]/g, 'o').replace(/[łŁ]/g, 'l')
    .replace(/[đĐð]/g, 'd').replace(/[ıİ]/g, 'i').replace(/[þÞ]/g, 'th')
    .toLowerCase()
    .replace(/['’ʻ`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (folded.length <= MAX_WORDS_LENGTH) return folded;
  const cut = folded.slice(0, MAX_WORDS_LENGTH);
  return cut.slice(0, cut.lastIndexOf('-') > 20 ? cut.lastIndexOf('-') : MAX_WORDS_LENGTH).replace(/-+$/, '');
}

/**
 * The slug before any collision suffix. `fallback` (the kind in English, "battle") stands in for a title that folds
 * to nothing or to a bare number, so a slug always has a letter and can't be read as an event id.
 */
export function baseSlug(title: string | null, year: number, fallback: string): string {
  const y = yearPart(year);
  let words = slugWords(title ?? '');
  if (!/[a-z]/.test(words)) words = [slugWords(fallback) || 'event', words].filter(Boolean).join('-');
  return words.endsWith(`-${y}`) || words.startsWith(`${y}-`) ? words : `${words}-${y}`;
}

/** The collision suffix: from the event's own key, so it never depends on what else was imported. */
export function keySuffix(key: string, length = 6): string {
  return createHash('sha1').update(key).digest('hex').slice(0, length);
}

/** A slug as a URL segment can carry it: what the builder writes and the route accepts. */
export const isSlug = (s: string) => s.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && /[a-z]/.test(s);
