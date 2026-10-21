import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readCapped } from '@/lib/core/net/read-capped';
import { TAKIP_USER_AGENT } from '@/lib/core/net/user-agent';
import { LIVE_CHANNELS, liveEmbedUrl, videoEmbedUrl, type LiveChannel } from './live-tv';

/**
 * Which channels are on air, and with which broadcast, read from each channel's /live page.
 *
 * YouTube's `live_stream?channel=` player answers "This video is unavailable" for most channels even while
 * they broadcast (2026-10-21: 10 of 24 played that way, 22 of the same 24 by video id), so the map plays
 * the broadcast itself. Its id changes whenever a stream restarts, hence a look every half hour rather than
 * an id in the table.
 */

export interface ChannelStatus {
  live: boolean;
  /** The broadcast on air, while live. */
  video: string | null;
  /** Whether the owner lets other sites play it. */
  embed: boolean;
  at: number;
}

/** A channel as /api/live-news serves it. `live` is null until the first look. */
export interface LiveFeed extends Omit<LiveChannel, 'channel'> {
  url: string;
  embed_allowed: boolean;
  live: boolean | null;
  /** The broadcast, or the channel's live page, on YouTube. */
  watch_url: string;
}

const TTL_MS = 30 * 60_000;
/** Past this a status is a guess, and the channel is served as unknown. */
const STALE_MS = 6 * 3_600_000;
// YouTube starts answering watch pages with a captcha at about 75 a minute from one address.
const SPACING_MS = 1_200;
const MAX_BYTES = 3_000_000;
const PLAYER = 'ytInitialPlayerResponse = {';
// Stop at the end of the player's script, or at a channel page (what /live redirects to off air).
const ENOUGH = /ytInitialPlayerResponse = \{[^]*?<\/script>|<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\//;
const OFF_AIR = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\//;
const VIDEO_ID = /^[\w-]{11}$/;

/** The JSON object starting at `start`, by matching braces outside strings. */
function objectAt(text: string, start: number): string | null {
  let depth = 0;
  let quoted = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '\\') i++;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** What a channel's /live page says is on air; null when the page says nothing either way. */
export function parseLivePage(html: string): Omit<ChannelStatus, 'at'> | null {
  const at = html.indexOf(PLAYER);
  if (at < 0) return OFF_AIR.test(html) ? { live: false, video: null, embed: false } : null;
  const json = objectAt(html, at + PLAYER.length - 1);
  if (!json) return null;
  let player: { playabilityStatus?: { status?: string; playableInEmbed?: boolean }; videoDetails?: { videoId?: string; isLive?: boolean } };
  try {
    player = JSON.parse(json);
  } catch {
    return null;
  }
  const video = player.videoDetails?.videoId;
  // An upcoming broadcast also sits on /live, with status LIVE_STREAM_OFFLINE.
  const live = player.playabilityStatus?.status === 'OK' && player.videoDetails?.isLive === true && !!video && VIDEO_ID.test(video);
  return live ? { live, video: video!, embed: player.playabilityStatus?.playableInEmbed === true } : { live: false, video: null, embed: false };
}

class Blocked extends Error {}

async function look(c: LiveChannel): Promise<Omit<ChannelStatus, 'at'> | null> {
  const res = await fetch(`https://www.youtube.com/channel/${c.channel}/live`, {
    headers: { 'User-Agent': TAKIP_USER_AGENT, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429 || new URL(res.url).hostname.endsWith('google.com')) throw new Blocked();
  if (!res.ok) return null;
  return parseLivePage(await readCapped(res, MAX_BYTES, ENOUGH));
}

/** Overridable so a test never touches the real cache; 'off' keeps it off disk. */
const cachePath = () => process.env.TAKIP_LIVE_TV_CACHE || join(process.cwd(), '.cache', 'live-tv.json');

let statuses: Record<string, ChannelStatus> = {};
let restored: Promise<void> | null = null;
let sweep: Promise<void> | null = null;
let sweptAt = 0;

async function restore() {
  if (process.env.TAKIP_LIVE_TV_CACHE === 'off') return;
  try {
    statuses = { ...JSON.parse(await readFile(cachePath(), 'utf8')), ...statuses };
    sweptAt = Math.min(...LIVE_CHANNELS.map(c => statuses[c.id]?.at ?? 0));
  } catch {
    // None yet: the first sweep writes it.
  }
}

async function persist() {
  if (process.env.TAKIP_LIVE_TV_CACHE === 'off') return;
  const path = cachePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(statuses));
  await rename(`${path}.tmp`, path);
}

/** One channel at a time; a failed look keeps the last status, and a captcha ends the sweep. */
async function refresh() {
  for (const c of LIVE_CHANNELS) {
    try {
      const s = await look(c);
      if (s) statuses = { ...statuses, [c.id]: { ...s, at: Date.now() } };
    } catch (e) {
      if (e instanceof Blocked) { console.warn('[TAKIP] live TV: YouTube asked for a captcha; trying again later'); break; }
    }
    await new Promise(r => setTimeout(r, SPACING_MS));
  }
  await persist().catch(e => console.warn('[TAKIP] live TV: could not save statuses:', e instanceof Error ? e.message : e));
}

/** Every channel with what is known of it now; a look runs in the background once the last is half an hour old. */
export async function liveFeeds(): Promise<LiveFeed[]> {
  restored ??= restore();
  await restored;
  if (!sweep && Date.now() - sweptAt > TTL_MS) {
    sweptAt = Date.now();
    sweep = refresh().finally(() => { sweep = null; });
  }
  const now = Date.now();
  return LIVE_CHANNELS.map(({ channel, ...c }) => {
    const s = statuses[c.id];
    const known = s && now - s.at < STALE_MS ? s : null;
    return {
      ...c,
      url: known?.live && known.video ? videoEmbedUrl(known.video) : liveEmbedUrl({ channel }),
      embed_allowed: known?.live ? known.embed : true,
      live: known ? known.live : null,
      watch_url: known?.live && known.video ? `https://www.youtube.com/watch?v=${known.video}` : `https://www.youtube.com/channel/${channel}/live`,
    };
  });
}
