import { describe, expect, it } from 'vitest';
import { crawlerKind, crawlerOf } from './crawlers';

describe('telling crawlers by their user agent', () => {
  it('names the well-known ones and what they are for', () => {
    expect(crawlerOf('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toEqual({ name: 'Googlebot', kind: 'search' });
    expect(crawlerOf('AdsBot-Google (+http://www.google.com/adsbot.html)')).toEqual({ name: 'AdsBot-Google', kind: 'ads' });
    expect(crawlerOf('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toEqual({ name: 'GPTBot (OpenAI)', kind: 'ai' });
    expect(crawlerOf('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')?.kind).toBe('ai');
    expect(crawlerOf('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)')).toEqual({ name: 'AhrefsBot', kind: 'seo' });
    expect(crawlerOf('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')?.kind).toBe('preview');
    expect(crawlerOf('python-requests/2.32.3')).toEqual({ name: 'Python scripts', kind: 'script' });
    expect(crawlerOf('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0 Safari/537.36')?.kind).toBe('script');
  });

  it('names an unknown bot by its own token, counts a missing user agent as a script, and leaves browsers alone', () => {
    expect(crawlerOf('Mozilla/5.0 (compatible; FooCrawler/3.1; +https://foo.example)')).toEqual({ name: 'FooCrawler', kind: 'other' });
    expect(crawlerOf(null)).toEqual({ name: 'No user agent', kind: 'script' });
    expect(crawlerOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36')).toBeNull();
    expect(crawlerOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBeNull();
  });

  it('finds the kind again from the name alone', () => {
    expect(crawlerKind('Bingbot')).toBe('search');
    expect(crawlerKind('PerplexityBot')).toBe('ai');
    expect(crawlerKind('FooCrawler')).toBe('other');
  });
});
