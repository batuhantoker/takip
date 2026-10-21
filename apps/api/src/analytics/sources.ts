/** How a visit arrived: from a search engine, an AI assistant, a social site, any other site, or with no referrer at all. */
export type Channel = 'search' | 'ai' | 'social' | 'site' | 'direct';

// First match wins, so gemini.google.com and news.google.com come before Google itself.
const SOURCES: [RegExp, string, Channel][] = [
  [/^gemini\.google\.com$|^bard\.google\.com$/, 'Gemini', 'ai'],
  [/^news\.google\.[a-z.]+$/, 'Google News', 'site'],
  [/^(?:mail|docs|drive|sites|groups)\.google\.[a-z.]+$/, 'Google apps', 'site'],
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
  [/^(?:chatgpt\.com|chat\.openai\.com)$/, 'ChatGPT', 'ai'],
  [/(?:^|\.)perplexity\.ai$/, 'Perplexity', 'ai'],
  [/^claude\.ai$/, 'Claude', 'ai'],
  [/^copilot\.microsoft\.com$/, 'Copilot', 'ai'],
  [/(?:^|\.)(?:you|phind|poe)\.com$|(?:^|\.)deepseek\.com$|^chat\.mistral\.ai$|^grok\.com$|^(?:www\.)?meta\.ai$/, 'Other AI assistants', 'ai'],
  [/^t\.co$|(?:^|\.)(?:x|twitter)\.com$/, 'X', 'social'],
  [/(?:^|\.)facebook\.com$|^fb\.me$/, 'Facebook', 'social'],
  [/(?:^|\.)instagram\.com$/, 'Instagram', 'social'],
  [/(?:^|\.)reddit\.com$|^redd\.it$/, 'Reddit', 'social'],
  [/^news\.ycombinator\.com$/, 'Hacker News', 'social'],
  [/(?:^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn', 'social'],
  [/(?:^|\.)youtube\.com$|^youtu\.be$/, 'YouTube', 'social'],
  [/(?:^|\.)tiktok\.com$/, 'TikTok', 'social'],
  [/(?:^|\.)pinterest\.[a-z.]+$/, 'Pinterest', 'social'],
  [/^t\.me$|(?:^|\.)telegram\.org$/, 'Telegram', 'social'],
  [/(?:^|\.)vk\.com$/, 'VK', 'social'],
  [/(?:^|\.)threads\.(?:net|com)$/, 'Threads', 'social'],
  [/(?:^|\.)bsky\.(?:app|social)$/, 'Bluesky', 'social'],
  [/(?:^|\.)(?:mastodon\.[a-z.]+|mstdn\.[a-z.]+)$/, 'Mastodon', 'social'],
  [/(?:^|\.)quora\.com$/, 'Quora', 'social'],
  [/(?:^|\.)discord(?:app)?\.com$/, 'Discord', 'social'],
  [/(?:^|\.)eksisozluk\.com$/, 'Ekşi Sözlük', 'social'],
];

/** 'www.google.com.tr' → Google (search); an unknown host is its own source, without 'www.'. Null host: direct. */
export function sourceOf(host: string | null): { source: string | null; channel: Channel } {
  if (!host) return { source: null, channel: 'direct' };
  for (const [pattern, source, channel] of SOURCES) if (pattern.test(host)) return { source, channel };
  return { source: host.replace(/^www\./, ''), channel: 'site' };
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
