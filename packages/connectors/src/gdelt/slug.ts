/**
 * TAKIP — what an article URL says about the article. GDELT events carry no titles, but most news
 * URLs end in a slug of the headline.
 */

const EXTENSION = /\.(s?html?|php|aspx?|cms)$/i;

const STOP = new Set(
  ('the a an of to in for on at and or is are was were be been with by from as after over new says said amid into its it ' +
    'has have how why what who will not this that more than about up out his her their they he she we you our your can ' +
    'could would may might make makes made just one two three first last before against then there here do does did get ' +
    'gets got also via vs us news ' +
    // The translated feed keeps original-language URLs: Spanish, Portuguese, French, Italian, German.
    'del las los por para con una uno que sobre tras ante sus son como mas pero sin entre hasta desde segun ' +
    'aos das dos nas nos uma com pelo pela les des aux une pour dans sur par avec est ' +
    'della delle dei che per nel nella degli gli una der die das und den dem mit von auf fur ist ein eine').split(' '),
);

/** The publisher's host, without www or a port. */
export function outletOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** The longest path segment that reads as words, lower-cased; empty under three words. */
export function slugWords(url: string): string[] {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return [];
  }
  let best: string[] = [];
  for (const raw of path.split('/')) {
    let seg = raw.replace(EXTENSION, '');
    try {
      seg = decodeURIComponent(seg);
    } catch { /* keep it encoded */ }
    // Ids ride along in slugs: 1595129-, -9.7378256, -20261013-p614vl.
    const words = seg.split(/[-_.+]+/).filter(w => /\p{L}/u.test(w) && !(/\d/.test(w) && w.length >= 5));
    if (words.length > best.length) best = words;
  }
  return best.length >= 3 ? best.map(w => w.toLowerCase()) : [];
}

export function slugHeadline(url: string): string | null {
  const text = slugWords(url).join(' ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
}

/** Every word in the host and path: sections and subdomains name places too (/estados/jalisco/). */
export function urlWords(url: string): Set<string> {
  let text: string;
  try {
    const u = new URL(url);
    text = `${u.hostname} ${decodeURIComponent(u.pathname)}`;
  } catch {
    text = url;
  }
  return new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

const stem = (w: string) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

/** Slug words that say what the story is about: no stop words, and none of the words naming the place. */
export function topicWords(url: string, place: string): Set<string> {
  const placeWords = new Set(place.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(stem));
  const out = new Set<string>();
  for (const w of slugWords(url)) {
    const s = stem(w);
    if (w.length > 2 && !STOP.has(w) && !placeWords.has(s)) out.add(s);
  }
  return out;
}
