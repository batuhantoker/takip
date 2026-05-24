import { NextResponse } from 'next/server';
import { fetchChannel, type TelegramPost } from '@/lib/telegram-scraper';
import { geoparse, hasConflictKeyword } from '@/lib/geo-dict';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Telegram Public-Channel OSINT Feed.
 *
 * Aggregates the most recent text posts from a curated set of public
 * Telegram channels (war reporting, fact-checking, geopolitics), filters
 * to posts mentioning conflict-relevant keywords, and geoparses them
 * against the shared place dictionary so they can be plotted on the map.
 *
 * All data is fetched via the unauthenticated web preview at `t.me/s/…`
 * — no Telegram Bot API token, no MTProto API ID, no key of any kind.
 *
 * The default channel list can be overridden by setting the
 * `OSIRIS_TELEGRAM_CHANNELS` env var to a comma-separated list of
 * channel usernames (without `@`).
 */

// Balanced default set: multi-source aggregators + one official source
// from each side of the Ukraine war so the layer surfaces both viewpoints
// rather than a single narrative. Operators can override via the
// `OSIRIS_TELEGRAM_CHANNELS` env var.
const DEFAULT_CHANNELS = [
  'osintdefender',    // Prominent English-language OSINT aggregator
  'insiderpaper',     // English breaking-news wire
  'aljazeeraenglish', // Al Jazeera English — Middle East coverage
  'nexta_live',       // Belarus / Ukraine OSINT (Cyrillic, multilingual)
  'war_monitor',      // Ukrainian-language war updates
];

const POSTS_PER_CHANNEL = 15;
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { fetchedAt: number; posts: TelegramPost[] };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<TelegramPost[]>>();

function activeChannels(): string[] {
  const env = process.env.OSIRIS_TELEGRAM_CHANNELS;
  if (!env) return DEFAULT_CHANNELS;
  return env
    .split(',')
    .map((s) => s.trim().replace(/^@/, ''))
    .filter(Boolean);
}

async function getChannelCached(channel: string): Promise<TelegramPost[]> {
  const cached = cache.get(channel);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.posts;
  }
  const pending = inflight.get(channel);
  if (pending) return pending;

  const p = (async () => {
    try {
      const posts = await fetchChannel(channel, POSTS_PER_CHANNEL);
      cache.set(channel, { fetchedAt: Date.now(), posts });
      return posts;
    } catch (e) {
      console.warn(
        '[OSIRIS] Telegram channel fetch failed:',
        channel,
        e instanceof Error ? e.message : e
      );
      // Serve stale on transient failure rather than blinding the layer.
      return cached?.posts ?? [];
    } finally {
      inflight.delete(channel);
    }
  })();

  inflight.set(channel, p);
  return p;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filterConflict = searchParams.get('all') !== '1';

  const channels = activeChannels();
  const channelResults = await Promise.all(channels.map(getChannelCached));

  const events: Array<{
    id: string;
    lat: number;
    lng: number;
    name: string;
    url: string;
    html: string;
    channel: string;
    datetime: string;
    type: 'telegram';
  }> = [];

  for (const posts of channelResults) {
    for (const post of posts) {
      if (filterConflict && !hasConflictKeyword(post.text)) continue;
      const match = geoparse(post.text, 0.6);
      if (!match) continue;

      const headline = post.text.slice(0, 140).replace(/\s+/g, ' ').trim();
      events.push({
        id: `telegram-${post.id.replace('/', '-')}`,
        lat: match.coords[1],
        lng: match.coords[0],
        name: `[@${post.channel}] ${headline}`,
        url: post.url,
        html: `<b>@${post.channel}</b><br/>${headline}<br/><a href="${post.url}" target="_blank">Open on Telegram</a>`,
        channel: post.channel,
        datetime: post.datetime,
        type: 'telegram',
      });
    }
  }

  return NextResponse.json(
    {
      events,
      total: events.length,
      channels,
      timestamp: new Date().toISOString(),
      source: 'Telegram public channels (t.me/s)',
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}
