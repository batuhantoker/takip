import { decodeEntities } from '@takip/connectors/advisories/rss';

/** What a page says about itself in its `<head>`: the card a chat app would show for its link. */
export interface LinkPreview {
  /** The page the preview describes, after redirects. */
  url: string;
  title: string | null;
  description: string | null;
  /** An absolute http(s) picture URL; the reader's browser loads it from the publisher. */
  image: string | null;
  site: string | null;
}

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 320;

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
};

const clean = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const space = s.lastIndexOf(' ', max);
  return `${s.slice(0, space > max * 0.6 ? space : max).trimEnd()}…`;
}

/** `<meta>` content by property, name or itemprop, lower-cased; the first of each wins. */
function metaTags(head: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop'))?.trim().toLowerCase();
    const content = attr(tag, 'content');
    if (key && content && !out.has(key)) out.set(key, content);
  }
  return out;
}

function absolute(src: string | undefined, base: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(decodeEntities(src.trim()), base);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    // The site's CSP loads https pictures only; most publishers serve both.
    u.protocol = 'https:';
    return u.toString();
  } catch {
    return null;
  }
}

export function parseLinkPreview(html: string, pageUrl: string): LinkPreview {
  const end = html.search(/<\/head>/i);
  const head = end >= 0 ? html.slice(0, end) : html;
  const meta = metaTags(head);
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = meta.get(k);
      if (v && clean(v)) return clean(v);
    }
    return null;
  };
  const docTitle = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = pick('og:title', 'twitter:title') ?? (docTitle && clean(docTitle) ? clean(docTitle) : null);
  const description = pick('og:description', 'twitter:description', 'description');
  const image = absolute(
    meta.get('og:image:secure_url') ?? meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image') ?? meta.get('twitter:image:src'),
    pageUrl,
  );
  let site = pick('og:site_name', 'application-name');
  if (!site) {
    try { site = new URL(pageUrl).hostname.replace(/^www\./, ''); } catch { site = null; }
  }
  // "Headline | Dunya News": the site is shown on its own line.
  const bare = title && site ? title.replace(new RegExp(`\\s+[|–—-]\\s+${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '') : title;
  return {
    url: pageUrl,
    title: bare ? clip(bare, TITLE_MAX) : null,
    description: description && description !== title ? clip(description, DESCRIPTION_MAX) : null,
    image,
    site,
  };
}
