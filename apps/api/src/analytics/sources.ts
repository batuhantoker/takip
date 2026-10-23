/** How a visit arrived: from a search engine, an AI assistant, a social site, any other site, or with no referrer at all. */
export type Channel = 'search' | 'ai' | 'social' | 'site' | 'direct';

// First match wins, so gemini.google.com, news.google.com and Google's Android apps come before Google itself. An Android
// app arrives as android-app://<package>, which reads as a host: com.google.android.googlequicksearchbox is the Google app.
const SOURCES: [RegExp, string, Channel][] = [
  [/^gemini\.google\.com$|^bard\.google\.com$|^com\.google\.android\.apps\.bard$/, 'Gemini', 'ai'],
  [/^news\.google\.[a-z.]+$|^com\.google\.android\.apps\.magazines$/, 'Google News', 'site'],
  [/^(?:mail|docs|drive|sites|groups)\.google\.[a-z.]+$|^com\.google\.android\.gm$/, 'Google apps', 'site'],
  [/^com\.google\.android\.youtube$/, 'YouTube', 'social'],
  [/(?:^|\.)google\.[a-z.]+$|^googleapis\.com$/, 'Google', 'search'],
  [/(?:^|\.)bing\.com$/, 'Bing', 'search'],
  [/(?:^|\.)duckduckgo\.com$/, 'DuckDuckGo', 'search'],
  [/(?:^|\.)yandex\.[a-z.]+$|(?:^|\.)ya\.ru$/, 'Yandex', 'search'],
  [/(?:^|\.)baidu\.com$/, 'Baidu', 'search'],
  [/(?:^|\.)yahoo\.[a-z.]+$/, 'Yahoo', 'search'],
  [/(?:^|\.)ecosia\.org$/, 'Ecosia', 'search'],
  [/^search\.brave\.com$/, 'Brave Search', 'search'],
  [/(?:^|\.)naver\.com$/, 'Naver', 'search'],
  [/(?:^|\.)seznam\.cz$/, 'Seznam', 'search'],
  [/(?:^|\.)qwant\.com$/, 'Qwant', 'search'],
  [/(?:^|\.)startpage\.com$/, 'Startpage', 'search'],
  [/(?:^|\.)kagi\.com$/, 'Kagi', 'search'],
  [/(?:^|\.)(?:sogou|so|mojeek|yep|presearch)\.com$/, 'Other search engines', 'search'],
  [/^(?:chatgpt\.com|chat\.openai\.com|com\.openai\.chatgpt)$/, 'ChatGPT', 'ai'],
  [/(?:^|\.)perplexity\.ai$|^ai\.perplexity\.app\.android$/, 'Perplexity', 'ai'],
  [/^claude\.ai$|^com\.anthropic\.claude$/, 'Claude', 'ai'],
  [/^copilot\.microsoft\.com$|^com\.microsoft\.copilot$/, 'Copilot', 'ai'],
  [/(?:^|\.)(?:you|phind|poe)\.com$|(?:^|\.)deepseek\.com$|^chat\.mistral\.ai$|^grok\.com$|^(?:www\.)?meta\.ai$/, 'Other AI assistants', 'ai'],
  [/^t\.co$|(?:^|\.)(?:x|twitter)\.com$|^com\.twitter\.android$/, 'X', 'social'],
  [/(?:^|\.)facebook\.com$|^fb\.me$|^com\.facebook\.(?:katana|orca|lite)$/, 'Facebook', 'social'],
  [/(?:^|\.)instagram\.com$|^com\.instagram\.android$/, 'Instagram', 'social'],
  [/(?:^|\.)reddit\.com$|^redd\.it$|^com\.reddit\.frontpage$/, 'Reddit', 'social'],
  [/^news\.ycombinator\.com$/, 'Hacker News', 'social'],
  [/(?:^|\.)linkedin\.com$|^lnkd\.in$|^com\.linkedin\.android$/, 'LinkedIn', 'social'],
  [/(?:^|\.)youtube\.com$|^youtu\.be$/, 'YouTube', 'social'],
  [/(?:^|\.)tiktok\.com$|^com\.zhiliaoapp\.musically$/, 'TikTok', 'social'],
  [/(?:^|\.)pinterest\.[a-z.]+$/, 'Pinterest', 'social'],
  [/^t\.me$|(?:^|\.)telegram\.org$|^org\.telegram\.messenger$/, 'Telegram', 'social'],
  [/(?:^|\.)whatsapp\.com$|^wa\.me$|^com\.whatsapp$/, 'WhatsApp', 'social'],
  [/(?:^|\.)vk\.com$/, 'VK', 'social'],
  [/(?:^|\.)threads\.(?:net|com)$/, 'Threads', 'social'],
  [/(?:^|\.)bsky\.(?:app|social)$/, 'Bluesky', 'social'],
  [/(?:^|\.)(?:mastodon\.[a-z.]+|mstdn\.[a-z.]+)$/, 'Mastodon', 'social'],
  [/(?:^|\.)quora\.com$/, 'Quora', 'social'],
  [/(?:^|\.)discord(?:app)?\.com$|^com\.discord$/, 'Discord', 'social'],
  [/(?:^|\.)slack\.com$|^com\.slack$/, 'Slack', 'social'],
  [/(?:^|\.)eksisozluk\.com$/, 'Ekşi Sözlük', 'social'],
];

/** 'www.google.com.tr' → Google (search); an unknown host is its own source, without 'www.'. Null host: direct. */
export function sourceOf(host: string | null): { source: string | null; channel: Channel } {
  if (!host) return { source: null, channel: 'direct' };
  for (const [pattern, source, channel] of SOURCES) if (pattern.test(host)) return { source, channel };
  return { source: host.replace(/^www\./, ''), channel: 'site' };
}

const squash = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The known source a link's utm_source (or ref, or source) names, by host or by name: 'chatgpt.com' and 'ChatGPT' →
 * ChatGPT (ai). Null for any other tag, which is a campaign. ChatGPT tags its links so, and often sends no referrer.
 */
export function sourceOfTag(tag: string | null): { source: string; channel: Channel } | null {
  if (!tag) return null;
  const name = squash(tag);
  for (const [pattern, source, channel] of SOURCES) if (pattern.test(tag.toLowerCase()) || squash(source) === name) return { source, channel };
  return null;
}

/** How a visit arrived: its referring site, else the source its link's tag names; the tag stays a campaign only when it names none. */
export function arrivalOf(host: string | null, tag: string | null): { source: string | null; channel: Channel; campaign: string | null } {
  const tagged = sourceOfTag(tag);
  return { ...(host || !tagged ? sourceOf(host) : tagged), campaign: tagged ? null : tag };
}

/** The referring host, else the link's tag when it names a known source ('chatgpt.com'): where a single origin is shown. */
export const originOf = (host: string | null, tag: string | null) => host || (sourceOfTag(tag) ? tag : null);

const CAMPAIGN = /^[a-z0-9._-]{1,60}$/;

/** utm_source, ref or source on a landing address, lowercased; null when it has none or it isn't a plain name. */
export function campaignOf(landing: string | null) {
  const query = landing?.split('?')[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const source = (params.get('utm_source') ?? params.get('ref') ?? params.get('source'))?.toLowerCase();
  return source && CAMPAIGN.test(source) ? source : null;
}

const LINK_PATH = /^\/[A-Za-z0-9\-._~/%@:+!,;=]{1,199}$/;

/**
 * The page on the referring site, kept for social and other sites only: a search's or an AI chat's address names
 * the person's query or conversation. Its query string never reaches here (the browser sends only the path).
 */
export function linkPathOf(host: string | null, path: unknown): string | null {
  if (typeof path !== 'string' || !LINK_PATH.test(path)) return null;
  const { channel } = sourceOf(host);
  return channel === 'social' || channel === 'site' ? path : null;
}
