import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cachedSource } from '@/lib/core/net/source-cache';
import { fingerprint, htmlToText, parseChannelPage, splitHeadline, type TelegramPost } from '@/lib/intel/alerts/telegram';
import type { Bloc } from '@/lib/intel/alerts/digest';
import { alertKind, budgetedLookup, locateReport, type AlertKind, type AlertPlace } from '@/lib/intel/alerts/alert-places';
import { TELEGRAM_CHANNELS, WIRE_FEEDS, type Feed } from '@/lib/intel/alerts/news-sources';

/**
 * TAKIP — Live Alerts news feed.
 *
 * Reads two kinds of source into one feed: public Telegram OSINT channels,
 * which are fast and carry footage, and wire services, which cover the ground
 * the channels ignore and keep publishing if Telegram blocks the host. Both
 * are read and merged the same way, so a story carried by several of them
 * folds into one report that names them all.
 *
 * Each source is cached on its own for a few minutes, so a busy dashboard
 * costs an upstream one request per window however many tabs are open, and a
 * source that fails a refresh keeps serving its last good items instead of
 * emptying the feed.
 */

type Channel = Feed;

/** A channel page holds about twenty posts; the age window decides how many of them stay. */
const POSTS_PER_CHANNEL = 20;
/** A wire publishes far more than a channel, so it contributes fewer items. */
const ITEMS_PER_WIRE = 10;
const CHANNEL_TTL_MS = 3 * 60_000;
const WIRE_TTL_MS = 5 * 60_000;
/** A live feed shows live posts: anything older is left out, however quiet the channel. */
export const MAX_POST_AGE_MS = 72 * 3_600_000;
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const RISK_KEYWORDS = ['war','missile','strike','attack','crisis','tension','military','conflict','defense','clash','nuclear','invasion','bomb','drone','weapon','sanctions','ceasefire','escalation', 'killed', 'destroyed', 'operation', 'casualty', 'frontline', 'threat'];

/* Whole words, plus plural and verb endings. Substring matching scored
   "award", "software" and "warning" as war, "cooperation" as an operation and
   "Bombay" as a bomb. */
const RISK_PATTERNS = RISK_KEYWORDS.map(kw => ({
  kw,
  rx: new RegExp(`\\b${kw === 'casualty' ? 'casualt(?:y|ies)' : `${kw}(?:s|es|ed|ing)?`}\\b`, 'i'),
}));

const KEYWORD_COORDS: Record<string, [number, number]> = {
  'ukraine': [49.487, 31.272], 'kyiv': [50.450, 30.523], 'russia': [61.524, 105.318],
  'moscow': [55.755, 37.617], 'israel': [31.046, 34.851], 'gaza': [31.416, 34.333],
  'iran': [32.427, 53.688], 'lebanon': [33.854, 35.862], 'syria': [34.802, 38.996],
  'yemen': [15.552, 48.516], 'china': [35.861, 104.195], 'taiwan': [23.697, 120.960],
  'united states': [38.907, -77.036], 'europe': [48.800, 2.300], 'middle east': [31.500, 34.800]
};

/**
 * Counts risk keywords in the text. That is the whole method: one point of
 * base, two per distinct term matched, capped at 10.
 *
 * It used to ship its output labelled "AI Analysis indicates elevated tactical
 * priority based on OSINT stream patterns." No model is consulted and no
 * pattern is learned — the phrasing lent a word count the authority of an
 * analytical judgement. The matched terms now travel with the score so a
 * reader can see exactly what produced it.
 */
export function scoreRisk(text: string): { score: number; matched: string[] } {
  const matched = RISK_PATTERNS.filter(p => p.rx.test(text)).map(p => p.kw);
  return { score: Math.min(10, 1 + matched.length * 2), matched };
}

/**
 * Resolves a place name to its preset anchor — a country or territory
 * centroid, not the location of the reported event. An article about a strike
 * in Rafah resolves to the middle of Gaza, because that is the only thing a
 * keyword match can support. Callers get the term that matched so the marker
 * can be labelled for what it is.
 */
export function findCoords(text: string): { coords: [number, number]; anchor: string } | null {
  const lower = text.toLowerCase();
  for (const [keyword, coords] of Object.entries(KEYWORD_COORDS)) {
    if (lower.includes(keyword)) return { coords, anchor: keyword };
  }
  return null;
}

/** The newest posts inside the live window, newest last as Telegram orders them. */
export function recentPosts(posts: TelegramPost[], now = Date.now()): TelegramPost[] {
  return posts
    .filter(p => now - Date.parse(p.publishedAt) <= MAX_POST_AGE_MS)
    .slice(-POSTS_PER_CHANNEL);
}

export interface ChannelPost { post: TelegramPost; channel: Pick<Channel, 'handle' | 'name' | 'lean' | 'bloc'> }

/**
 * Folds the same report posted by several channels into one story: the
 * earliest post leads and the others are listed as carrying it. Forwards are
 * the common case, so this records who carried a story, not who confirmed it.
 */
export function mergeCrossPosts(posts: ChannelPost[]): { lead: ChannelPost; carriedBy: ChannelPost[] }[] {
  const byKey = new Map<string, ChannelPost[]>();
  for (const p of posts) {
    const fp = fingerprint(p.post.text);
    // Too short to tell two different posts apart ("Video", "Map update").
    const key = fp.split(' ').length >= 6 ? fp : `id:${p.post.id}`;
    byKey.set(key, [...(byKey.get(key) || []), p]);
  }
  return [...byKey.values()].map(group => {
    const [lead, ...rest] = [...group].sort((a, b) => Date.parse(a.post.publishedAt) - Date.parse(b.post.publishedAt));
    // A channel reposting itself is not a second channel carrying the story.
    const seen = new Set([lead.channel.handle]);
    const carriedBy = rest.filter(c => {
      if (seen.has(c.channel.handle)) return false;
      seen.add(c.channel.handle);
      return true;
    });
    return { lead, carriedBy };
  });
}

const channelFeeds = TELEGRAM_CHANNELS.map(channel => ({
  channel,
  load: cachedSource<TelegramPost>(`telegram:${channel.handle}`, async () => {
    const res = await fetch(`https://t.me/s/${channel.handle}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': BROWSER_UA },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Cached whole; the age window is applied per request, as posts age in the cache.
    return parseChannelPage(await res.text(), channel.handle);
  }, CHANNEL_TTL_MS),
}));

/**
 * A wire item in the shape the rest of the route already speaks, so a story
 * from BBC and the same story from Al Jazeera fold together exactly as two
 * channels carrying one report do, and every consumer downstream — the cards,
 * the threads, the place lookup — needs no branch for where an item came from.
 */
export function wirePost(item: RssItem, feed: Feed): TelegramPost {
  const text = item.description && item.description !== item.title
    ? `${item.title}\n\n${item.description}`
    : item.title;
  const { headline, summary, flag } = splitHeadline(text);
  return {
    id: `${feed.handle}/${hashId(item.link || item.title).slice(0, 12)}`,
    channel: feed.handle,
    url: item.link,
    publishedAt: item.pubDate,
    text,
    headline,
    flag,
    summary,
    // A wire's own pictures are not ours to serve; the item links to its page.
    media: null,
    forwardedFrom: null,
    replyTo: null,
    views: null,
  };
}

const wireFeeds = WIRE_FEEDS.map(feed => ({
  channel: feed,
  load: cachedSource<TelegramPost>(`wire:${feed.handle}`, async () => {
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Not every feed lists newest first (The Guardian, AllAfrica), so sort before cutting.
    const items = parseRSSItems(await res.text(), feed.name)
      .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
      .slice(0, ITEMS_PER_WIRE);
    // Oldest first, as a channel page arrives, so recentPosts takes the newest.
    return items
      .map(item => wirePost(item, feed))
      .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  }, WIRE_TTL_MS),
}));

export interface RssItem { title: string; description: string; link: string; pubDate: string; source: string }

export function parseRSSItems(xml: string, sourceName: string): RssItem[] {
  const items: RssItem[] = [];
  // Dawn puts an xmlns on every <item>.
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return (m?.[1] || m?.[2] || '').trim();
    };

    const title = htmlToText(getTag('title'));
    const pubDate = getTag('pubDate');
    // Same rule as Telegram: no timestamp, no item — never back-dated to "now".
    if (!title || !pubDate || Number.isNaN(Date.parse(pubDate))) continue;

    items.push({
      title: title.length > 140 ? `${title.substring(0, 140)}…` : title,
      description: htmlToText(getTag('description')),
      link: getTag('link'),
      pubDate: new Date(pubDate).toISOString(),
      source: sourceName,
    });
  }
  return items;
}

function assess(text: string) {
  const risk = scoreRisk(text);
  const located = findCoords(text);
  return {
    risk_score: risk.score,
    /* How the score was produced, and from what. Both fields exist so no
       consumer has to take the number on trust. */
    risk_method: 'keyword-count',
    risk_keywords: risk.matched,
    keyword_assessment: risk.score >= 8
      ? `Keyword filter matched ${risk.matched.length} risk terms: ${risk.matched.join(', ')}.`
      : null,
    coords: located ? located.coords : null,
    coords_default: !located,
    /* 'country-anchor' means the marker is a preset centroid for the term
       in `coords_anchor`, not the location of the reported event. */
    location_precision: located ? 'country-anchor' as const : null,
    coords_anchor: located ? located.anchor : null,
  };
}

const hashId = (s: string) => crypto.createHash('md5').update(s).digest('hex');

/** How an item names where it came from: the channel, or the wire's own site. */
export function sourceRef(channel: Channel): string {
  const wire = WIRE_FEEDS.find(f => f.handle === channel.handle);
  if (!wire) return `t.me/${channel.handle}`;
  try {
    return new URL(wire.url).hostname.replace(/^www\./, '');
  } catch {
    return channel.handle;
  }
}

interface Carrier { source: string; source_name: string; lean: string; bloc: Bloc; link: string; published: string }

type NewsItem = {
  id: string;
  title: string;
  summary: string;
  description: string;
  link: string;
  published: string;
  source: string;
  source_name: string;
  lean: string | null;
  bloc: Bloc | null;
  flag: TelegramPost['flag'];
  media: TelegramPost['media'];
  forwarded_from: TelegramPost['forwardedFrom'];
  reply_to: string | null;
  views: number | null;
  also_reported_by: Carrier[];
  /** Rocket, event or news — see alertKind. */
  alert_kind: AlertKind;
  /** The place the report names, when one resolved; see locateReport. */
  place: Omit<AlertPlace, 'lat' | 'lng'> | null;
} & Omit<ReturnType<typeof assess>, 'location_precision'> & {
  location_precision: 'country-anchor' | AlertPlace['precision'] | null;
};

/** How many questions this feed may put to Nominatim on one refresh. */
const LOOKUPS_PER_REFRESH = 15;

/** How long a request waits for place lookups before answering with what it has. */
const PLACE_BUDGET_MS = 2500;

/**
 * Pins each item to the place it names, where one resolves. Lookups are
 * throttled to Nominatim's one a second, so a cold start cannot place every
 * item inside one request: whatever has not resolved by the budget keeps its
 * country anchor this time, and the lookup carries on so the next refresh has it.
 */
async function placeItems(items: NewsItem[]): Promise<void> {
  const found = new Map<string, AlertPlace>();
  /* One budget of new questions for the whole refresh, claimed by the newest
     reports first; everything else is placed from names already known. Without
     it a feed of a hundred reports asks Nominatim several hundred questions
     every few minutes, which is how this app came to be running at ten times
     the rate its operators allow — see lib/places/nominatim.ts. What goes unasked now
     is asked on a later refresh, and an answer is kept for a month. */
  const newestFirst = [...items].sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
  const lookup = budgetedLookup(LOOKUPS_PER_REFRESH);

  const all = Promise.all(newestFirst.map(async item => {
    const place = await locateReport(item.title, item.description, lookup).catch(() => null);
    if (place) found.set(item.id, place);
  }));
  await Promise.race([all, new Promise(resolve => setTimeout(resolve, PLACE_BUDGET_MS))]);

  for (const item of items) {
    const place = found.get(item.id);
    if (!place) continue;
    item.coords = [place.lat, place.lng];
    item.coords_default = false;
    item.location_precision = place.precision;
    item.coords_anchor = place.name;
    item.place = { name: place.name, label: place.label, precision: place.precision };
  }
}

/**
 * The feed, built at most once a minute and shared by every reader.
 *
 * Building it resolves places, and a place lookup is a request to somebody
 * else's server. Built per request, a hundred dashboards polling would have
 * multiplied that by a hundred — the shape of the problem Nominatim's
 * operators wrote to us about. Built once, they all read the same answer.
 */
let feed: { at: number; body: FeedPayload } | null = null;
let building: Promise<FeedPayload> | null = null;
const FEED_TTL_MS = 60_000;

interface SourceHealth {
  handle: string;
  name: string;
  lean: string;
  bloc: Bloc;
  kind: 'telegram' | 'wire';
  count: number;
  latest: string | null;
}

interface FeedPayload {
  news: NewsItem[];
  total: number;
  sources: SourceHealth[];
  timestamp: string;
}

async function buildFeed(): Promise<FeedPayload> {
  {
    const now = Date.now();
    /* Channels and wires are read the same way and fail the same way: one
       source that is slow or blocked costs its own items, not the feed. */
    const loaded = await Promise.all([...channelFeeds, ...wireFeeds].map(async f => {
      const all = await f.load().catch(() => [] as TelegramPost[]);
      return { channel: f.channel, all, posts: recentPosts(all, now) };
    }));

    const wireHandles = new Set(WIRE_FEEDS.map(f => f.handle));
    const sources = loaded.map(({ channel, all, posts }) => ({
      handle: channel.handle,
      name: channel.name,
      lean: channel.lean,
      bloc: channel.bloc,
      /** Where it was read from, so the panel can say what kind of source it is. */
      kind: wireHandles.has(channel.handle) ? 'wire' as const : 'telegram' as const,
      /** Posts inside the live window. */
      count: posts.length,
      /** The channel's newest post, even when it is older than the window. */
      latest: all.length ? all[all.length - 1].publishedAt : null,
    }));

    const stories = mergeCrossPosts(loaded.flatMap(({ channel, posts }) => posts.map(post => ({ post, channel }))));

    const newsItems: NewsItem[] = stories.map(({ lead: { post, channel }, carriedBy }) => ({
      id: hashId(post.url),
      title: post.headline,
      summary: post.summary,
      description: post.text,
      link: post.url,
      published: post.publishedAt,
      source: sourceRef(channel),
      source_name: channel.name,
      lean: channel.lean,
      bloc: channel.bloc,
      flag: post.flag,
      media: post.media,
      forwarded_from: post.forwardedFrom,
      reply_to: post.replyTo,
      views: post.views,
      also_reported_by: carriedBy.map(c => ({
        source: sourceRef(c.channel),
        source_name: c.channel.name,
        lean: c.channel.lean,
        bloc: c.channel.bloc,
        link: c.post.url,
        published: c.post.publishedAt,
      })),
      alert_kind: alertKind(post.headline, post.text),
      place: null,
      ...assess(post.text),
    }));

    await placeItems(newsItems);

    newsItems.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));

    return {
      news: newsItems,
      total: newsItems.length,
      sources,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function GET() {
  try {
    const fresh = feed && Date.now() - feed.at < FEED_TTL_MS;
    if (!fresh) {
      // One build at a time: concurrent readers wait for it rather than each
      // starting their own and spending the place budget several times over.
      building ??= buildFeed().finally(() => { building = null; });
      const body = await building;
      feed = { at: Date.now(), body };
    }
    return NextResponse.json(feed!.body, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch {
    // A build that fails leaves the last good feed in place, if there is one.
    if (feed) return NextResponse.json(feed.body, { headers: { 'Cache-Control': 'public, s-maxage=30' } });
    return NextResponse.json({ news: [], error: 'Failed to fetch intel' }, { status: 500 });
  }
}
