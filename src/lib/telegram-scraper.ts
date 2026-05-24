/**
 * Telegram public-channel scraper.
 *
 * Fetches the public web preview at `https://t.me/s/<channel>` (no auth,
 * no Bot API token, no MTProto) and extracts the most recent posts from
 * the HTML. Only channels that have web preview enabled are reachable
 * this way — most well-known OSINT channels do.
 *
 * The scraper parses with regex rather than a full DOM library to avoid
 * pulling in `jsdom` / `cheerio` just for a handful of fields. The Telegram
 * widget markup is stable and well-formed enough for this to be safe.
 */

export interface TelegramPost {
  /** `<channel>/<post-id>` — unique across the scraper. */
  id: string;
  /** Channel username (without `@`). */
  channel: string;
  /** Plain-text body with HTML stripped and `<br>` converted to newlines. */
  text: string;
  /** Permalink to the post on t.me. */
  url: string;
  /** ISO-8601 timestamp from the `<time datetime=...>` attribute. */
  datetime: string;
  /** View counter as displayed (e.g. `"40.9K"`), or `undefined` if absent. */
  views?: string;
}

const POST_WRAP_RE = /<div class="tgme_widget_message_wrap[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
const TEXT_RE = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/;
const DATE_HREF_RE = /<a class="tgme_widget_message_date"[^>]*href="(https:\/\/t\.me\/[^"]+)"/;
const TIME_RE = /<time[^>]*datetime="([^"]+)"/;
const VIEWS_RE = /<span class="tgme_widget_message_views">([^<]+)<\/span>/;
const POST_DATA_RE = /data-post="([^"]+)"/;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a\s[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Fetches and parses a single channel. Returns up to `limit` of the most
 * recent posts (Telegram's web preview returns them oldest-first, so we
 * slice from the tail).
 */
export async function fetchChannel(
  channel: string,
  limit = 20
): Promise<TelegramPost[]> {
  const safe = channel.replace(/^@/, '').trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/.test(safe)) {
    throw new Error(`Invalid Telegram channel name: ${channel}`);
  }

  const res = await fetch(`https://t.me/s/${safe}`, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      // Telegram serves the widget HTML to ordinary browser UAs. A bare
      // `node-fetch` UA sometimes gets a stripped response.
      'User-Agent': 'Mozilla/5.0 (compatible; OsirisOSINT/1.0; +https://osirisai.live)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`t.me/${safe} HTTP ${res.status}`);
  const html = await res.text();

  const posts: TelegramPost[] = [];
  const wrappers = html.match(POST_WRAP_RE) || [];
  for (const wrap of wrappers) {
    const textMatch = wrap.match(TEXT_RE);
    const timeMatch = wrap.match(TIME_RE);
    const linkMatch = wrap.match(DATE_HREF_RE);
    const dataMatch = wrap.match(POST_DATA_RE);
    const viewsMatch = wrap.match(VIEWS_RE);

    // Skip media-only posts (no text body) — geoparse needs words.
    if (!textMatch || !timeMatch || !linkMatch || !dataMatch) continue;

    posts.push({
      id: dataMatch[1],
      channel: safe,
      text: stripHtml(textMatch[1]),
      url: linkMatch[1],
      datetime: timeMatch[1],
      views: viewsMatch?.[1]?.trim(),
    });
  }

  // Telegram returns oldest-first; the freshest posts are at the tail.
  return posts.slice(-limit).reverse();
}
