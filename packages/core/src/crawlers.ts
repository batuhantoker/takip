/** What a crawler is for: search engines, AI companies, SEO tools, link previews, ad checks, uptime monitors, scripts, archives. */
export type CrawlerKind = 'search' | 'ai' | 'seo' | 'preview' | 'ads' | 'monitor' | 'script' | 'archive' | 'other';

export const CRAWLER_KINDS: readonly CrawlerKind[] = ['search', 'ai', 'seo', 'preview', 'ads', 'monitor', 'script', 'archive', 'other'];

export const CRAWLER_KIND_LABEL: Record<CrawlerKind, string> = {
  search: 'Search engines', ai: 'AI companies', seo: 'SEO tools', preview: 'Link previews', ads: 'Ad checks',
  monitor: 'Uptime monitors', script: 'Scripts and headless browsers', archive: 'Archives', other: 'Other bots',
};

// First match wins, so the specific names (AdsBot-Google, Googlebot-Image) come before the general ones.
const KNOWN: [RegExp, string, CrawlerKind][] = [
  [/AdsBot-Google|Google-Adwords/i, 'AdsBot-Google', 'ads'],
  [/Mediapartners-Google/i, 'AdSense (Mediapartners-Google)', 'ads'],
  [/Google-InspectionTool/i, 'Google-InspectionTool', 'search'],
  [/Googlebot-Image/i, 'Googlebot-Image', 'search'],
  [/Googlebot-Video/i, 'Googlebot-Video', 'search'],
  [/Googlebot-News/i, 'Googlebot-News', 'search'],
  [/Storebot-Google/i, 'Storebot-Google', 'search'],
  [/Googlebot/i, 'Googlebot', 'search'],
  [/GoogleOther/i, 'GoogleOther', 'ai'],
  [/Google-CloudVertexBot/i, 'Google-CloudVertexBot', 'ai'],
  [/FeedFetcher-Google|APIs-Google|Google-Site-Verification|Google-Read-Aloud/i, 'Google (other fetchers)', 'other'],
  [/bingbot|BingPreview|msnbot/i, 'Bingbot', 'search'],
  [/Applebot/i, 'Applebot', 'search'],
  [/DuckDuckBot|DuckAssistBot/i, 'DuckDuckBot', 'search'],
  [/YandexBot|YandexImages|YandexMobileBot|Yandex(?:Accessibility|Renderer)Bot/i, 'YandexBot', 'search'],
  [/Baiduspider/i, 'Baiduspider', 'search'],
  [/PetalBot/i, 'PetalBot (Huawei)', 'search'],
  [/SeznamBot/i, 'SeznamBot', 'search'],
  [/Sogou/i, 'Sogou', 'search'],
  [/YisouSpider/i, 'YisouSpider', 'search'],
  [/Yeti\//i, 'Naver Yeti', 'search'],
  [/coccocbot/i, 'Cốc Cốc', 'search'],
  [/MojeekBot/i, 'MojeekBot', 'search'],
  [/Qwantbot|Qwantify/i, 'Qwant', 'search'],
  [/OAI-SearchBot/i, 'OAI-SearchBot (OpenAI)', 'ai'],
  [/ChatGPT-User/i, 'ChatGPT-User (OpenAI)', 'ai'],
  [/GPTBot/i, 'GPTBot (OpenAI)', 'ai'],
  [/Claude-SearchBot/i, 'Claude-SearchBot (Anthropic)', 'ai'],
  [/Claude-User/i, 'Claude-User (Anthropic)', 'ai'],
  [/ClaudeBot|anthropic-ai/i, 'ClaudeBot (Anthropic)', 'ai'],
  [/Perplexity-User/i, 'Perplexity-User', 'ai'],
  [/PerplexityBot/i, 'PerplexityBot', 'ai'],
  [/meta-externalagent/i, 'Meta AI (meta-externalagent)', 'ai'],
  [/Bytespider/i, 'Bytespider (ByteDance)', 'ai'],
  [/Amazonbot/i, 'Amazonbot', 'ai'],
  [/CCBot/i, 'CCBot (Common Crawl)', 'ai'],
  [/cohere-ai|cohere-training/i, 'Cohere', 'ai'],
  [/MistralAI-User/i, 'MistralAI-User', 'ai'],
  [/Diffbot/i, 'Diffbot', 'ai'],
  [/YouBot/i, 'YouBot (You.com)', 'ai'],
  [/Timpibot/i, 'Timpibot', 'ai'],
  [/ImagesiftBot/i, 'ImagesiftBot', 'ai'],
  [/PanguBot/i, 'PanguBot (Huawei)', 'ai'],
  [/AhrefsBot|AhrefsSiteAudit/i, 'AhrefsBot', 'seo'],
  [/SemrushBot|SiteAuditBot/i, 'SemrushBot', 'seo'],
  [/MJ12bot/i, 'MJ12bot (Majestic)', 'seo'],
  [/DotBot/i, 'DotBot (Moz)', 'seo'],
  [/DataForSeoBot/i, 'DataForSeoBot', 'seo'],
  [/BLEXBot/i, 'BLEXBot', 'seo'],
  [/serpstatbot/i, 'serpstatbot', 'seo'],
  [/SeekportBot/i, 'SeekportBot', 'seo'],
  [/barkrowler/i, 'Barkrowler', 'seo'],
  [/Screaming Frog/i, 'Screaming Frog', 'seo'],
  [/facebookexternalhit|meta-externalfetcher|facebookcatalog/i, 'Facebook preview', 'preview'],
  [/Twitterbot/i, 'Twitterbot (X)', 'preview'],
  [/LinkedInBot/i, 'LinkedInBot', 'preview'],
  [/Slackbot/i, 'Slackbot', 'preview'],
  [/Discordbot/i, 'Discordbot', 'preview'],
  [/TelegramBot/i, 'TelegramBot', 'preview'],
  [/WhatsApp/i, 'WhatsApp preview', 'preview'],
  [/Pinterestbot/i, 'Pinterestbot', 'preview'],
  [/redditbot/i, 'redditbot', 'preview'],
  [/Embedly|Iframely|SkypeUriPreview|vkShare|Mastodon\//i, 'Other link previews', 'preview'],
  [/UptimeRobot|Pingdom|StatusCake|Better ?Uptime|Site24x7|UptimeKuma|Uptime-Kuma|Checkly|Cloudflare-Healthchecks/i, 'Uptime monitors', 'monitor'],
  [/archive\.org_bot|ia_archiver|Wayback/i, 'Internet Archive', 'archive'],
  [/HeadlessChrome|PhantomJS|Puppeteer|Playwright|Lighthouse|Chrome-Lighthouse/i, 'Headless browsers', 'script'],
  [/^curl\//i, 'curl', 'script'],
  [/^Wget\//i, 'Wget', 'script'],
  [/python-requests|python-httpx|aiohttp|Python-urllib|Scrapy/i, 'Python scripts', 'script'],
  [/Go-http-client/i, 'Go scripts', 'script'],
  [/node-fetch|axios\/|undici|^node$/i, 'Node scripts', 'script'],
  [/okhttp|Java\/|Apache-HttpClient|libwww-perl|Ruby|PHP\//i, 'Other scripts', 'script'],
];

const GENERIC = /([A-Za-z0-9_.-]*(?:bot|crawler|spider|crawl|slurp)[A-Za-z0-9_.-]*)/i;

/** Who a user agent says it is, when it's a crawler or a script; null for a browser. By the user agent alone: a claim, not verified. */
export function crawlerOf(userAgent: string | null | undefined): { name: string; kind: CrawlerKind } | null {
  if (!userAgent) return { name: 'No user agent', kind: 'script' };
  for (const [pattern, name, kind] of KNOWN) if (pattern.test(userAgent)) return { name, kind };
  const generic = GENERIC.exec(userAgent);
  return generic ? { name: generic[1].slice(0, 60), kind: 'other' } : null;
}

const BY_NAME = new Map(KNOWN.map(([, name, kind]) => [name, kind]));

/** The kind of a crawler by the name crawlerOf gave it. */
export const crawlerKind = (name: string): CrawlerKind => BY_NAME.get(name) ?? (name === 'No user agent' ? 'script' : 'other');
