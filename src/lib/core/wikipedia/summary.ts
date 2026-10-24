export interface WikiSummary {
  title: string;
  description: string | null;
  extract: string;
  image: { src: string; width: number; height: number } | null;
  /** The same picture up to 960 px wide, for a page that shows it large. */
  large?: string | null;
  url: string;
}

const LARGE_PX = 960;

/** Wikimedia scales thumbnails only down, and in fixed steps (960 is one); a smaller original is used as it is. */
export function largeImage(thumb: string | undefined, original: { source: string; width: number } | undefined): string | null {
  if (!thumb || !original) return thumb ?? null;
  const scalable = /\.svg$/i.test(original.source) || original.width >= LARGE_PX;
  return scalable && /\/\d+px-/.test(thumb) ? thumb.replace(/\/\d+px-/, `/${LARGE_PX}px-`) : original.source;
}

/** A summary in the reader's Wikipedia when it has the article, else the English one; `lang` says which. */
export type WikiArticle = WikiSummary & { lang: string };

/** The lead cut at a sentence end near `max` characters. */
export function trimExtract(text: string, max = 420): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

// A full stop after one or two letters or digits is an initial, an abbreviation or a German date ("J. Smith", "19. April").
const SENTENCE_END = /(?<=[.!?])(?<!(?:^|[\s(.])[\p{L}\p{N}]{1,2}\.)\s+(?=[\p{Lu}\p{N}"“‘(])|(?<=[。！？])/u;
// Wikipedia leaves a space where it dropped a reading ("サラミスの海戦 は").
const CJK_GAP = /(?<=[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}])\s+(?=[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}])/gu;

/** The opening sentences that fit in `max` characters; the first alone is cut at a word when it doesn't. */
export function leadSentences(source: string, max: number): string {
  const text = source.trim().replace(CJK_GAP, '');
  let out = '';
  for (const s of text.split(SENTENCE_END)) {
    const next = !out ? s : /[。！？]$/.test(out) ? out + s : `${out} ${s}`;
    if ([...next].length > max) break;
    out = next;
  }
  if (out) return out;
  const cut = [...text].slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, '')}…`;
}
