export interface WikiSummary {
  title: string;
  description: string | null;
  extract: string;
  image: { src: string; width: number; height: number } | null;
  url: string;
}

/** The lead cut at a sentence end near `max` characters. */
export function trimExtract(text: string, max = 420): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}
