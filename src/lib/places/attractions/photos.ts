/**
 * Each thing to do's picture: its Wikidata image (P18, through the item's free page image) as Wikimedia Commons
 * scales it, with the author and licence Commons records for that file, which every picture shown must credit.
 * Server only; Wikimedia asks for a descriptive User-Agent and batches of 50.
 */

export interface Photo {
  src: string;
  width: number;
  height: number;
  /** The file's page on Commons, where its licence is. */
  page: string;
  author: string | null;
  licence: string | null;
}

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const BATCH = 50;
// One of the widths Wikimedia keeps scaled copies at; others are served at the next one up.
const WIDTH = 500;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const api = (host: string, params: Record<string, string>) =>
  `https://${host}/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', ...params })}`;

/** Commons gives the author as HTML ("<a href=…>Name</a>"); the name is what is credited. */
export const plainText = (html: string | undefined) =>
  html?.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || null;

type Meta = Record<string, { value?: string } | undefined>;

/** Who to credit: the linked name where Commons links one (a user page), else the first sentence of what it says. */
export function authorOf(html: string | undefined): string | null {
  const linked = plainText(/<a\b[^>]*>(.*?)<\/a>/i.exec(html ?? '')?.[1]);
  const text = linked ?? plainText(html)?.split(/(?<=\.)\s/)[0] ?? null;
  return text && text.length > 80 ? `${text.slice(0, 79).trimEnd()}…` : text;
}

/** Pictures by Wikidata id; an item with no free picture is left out. */
export async function fetchPhotos(ids: readonly string[]): Promise<Record<string, Photo>> {
  const files = new Map<string, string>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const body = await getJson<{ query?: { pages?: { title: string; pageprops?: { page_image_free?: string } }[] } }>(
      api('www.wikidata.org', { prop: 'pageprops', ppprop: 'page_image_free', titles: ids.slice(i, i + BATCH).join('|') }));
    for (const p of body.query?.pages ?? []) if (p.pageprops?.page_image_free) files.set(p.title, p.pageprops.page_image_free);
  }
  const byFile = new Map<string, Photo>();
  const names = [...new Set(files.values())];
  for (let i = 0; i < names.length; i += BATCH) {
    const body = await getJson<{ query?: { normalized?: { from: string; to: string }[]; pages?: { title: string; imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; descriptionurl?: string; extmetadata?: Meta }[] }[] } }>(
      api('commons.wikimedia.org', {
        prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(WIDTH), iiextmetadatafilter: 'Artist|LicenseShortName',
        titles: names.slice(i, i + BATCH).map(n => `File:${n}`).join('|'),
      }));
    const from = new Map((body.query?.normalized ?? []).map(n => [n.to, n.from]));
    for (const p of body.query?.pages ?? []) {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl || !info.descriptionurl) continue;
      const asked = (from.get(p.title) ?? p.title).replace(/^File:/, '');
      byFile.set(asked, {
        src: info.thumburl.split('?')[0], width: info.thumbwidth ?? WIDTH, height: info.thumbheight ?? WIDTH, page: info.descriptionurl,
        author: authorOf(info.extmetadata?.Artist?.value), licence: plainText(info.extmetadata?.LicenseShortName?.value),
      });
    }
  }
  // Wikidata writes spaces as underscores in the page image's name; Commons answers with spaces.
  return Object.fromEntries([...files].flatMap(([id, file]) => {
    const photo = byFile.get(file) ?? byFile.get(file.replace(/_/g, ' '));
    return photo ? [[id, photo]] : [];
  }));
}
