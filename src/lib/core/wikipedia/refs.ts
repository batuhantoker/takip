/** A title an importer stored: no characters Wikipedia forbids in titles, and not a path or a query. */
export const isArticleTitle = (s: string) => s.length > 0 && s.length <= 255 && !/[#<>[\]{}|\u0000-\u001f\u007f]/.test(s) && !/^[./]/.test(s);

/**
 * attrs.wiki is an English title, or "fr:Titre" for an article in another Wikipedia. Wiki codes are lowercase
 * and titles start uppercase, so the prefix can't be mistaken for part of an English title.
 */
export function articleRef(stored: string): { lang: string; title: string } {
  const m = stored.match(/^([a-z][a-z0-9-]{1,15}):(.+)$/);
  return m ? { lang: m[1], title: m[2] } : { lang: 'en', title: stored };
}

/** The other way round; tools/import/wiki.ts writes the same form. */
export const wikiRef = (lang: string, title: string) => (lang === 'en' ? title : `${lang}:${title}`);

/** "https://fr.wikipedia.org/wiki/Royaume_de_France" → "fr:Royaume de France"; null for any other URL. */
export function refFromUrl(url: string): string | null {
  const m = url.match(/^https:\/\/([a-z][a-z0-9-]{1,15})\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)$/);
  if (!m) return null;
  try {
    const title = decodeURIComponent(m[2]).replace(/_/g, ' ');
    return isArticleTitle(title) ? wikiRef(m[1], title) : null;
  } catch {
    return null;
  }
}

export const articleUrl = (stored: string) => {
  const { lang, title } = articleRef(stored);
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
};
