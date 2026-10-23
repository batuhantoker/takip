import { describe, expect, it } from 'vitest';
import { arrivalOf, campaignOf, originOf, sourceOf, sourceOfTag } from './sources';

describe('where a visit came from', () => {
  it('names Android apps by their package', () => {
    expect(sourceOf('com.google.android.googlequicksearchbox')).toEqual({ source: 'Google', channel: 'search' });
    expect(sourceOf('com.google.android.youtube')).toEqual({ source: 'YouTube', channel: 'social' });
    expect(sourceOf('com.google.android.gm')).toEqual({ source: 'Google apps', channel: 'site' });
    expect(sourceOf('com.reddit.frontpage')).toEqual({ source: 'Reddit', channel: 'social' });
  });

  it('reads a link tag that names a known source, by host or by name', () => {
    expect(sourceOfTag('chatgpt.com')).toEqual({ source: 'ChatGPT', channel: 'ai' });
    expect(sourceOfTag('Perplexity')).toEqual({ source: 'Perplexity', channel: 'ai' });
    expect(sourceOfTag('hackernews')).toEqual({ source: 'Hacker News', channel: 'social' });
    expect(sourceOfTag('newsletter')).toBeNull();
    expect(sourceOfTag(null)).toBeNull();
  });

  it('takes the referrer first, then the tag, and keeps only an unknown tag as a campaign', () => {
    expect(arrivalOf(null, 'chatgpt.com')).toEqual({ source: 'ChatGPT', channel: 'ai', campaign: null });
    expect(arrivalOf('chatgpt.com', 'chatgpt.com')).toEqual({ source: 'ChatGPT', channel: 'ai', campaign: null });
    expect(arrivalOf('www.google.com', 'newsletter')).toEqual({ source: 'Google', channel: 'search', campaign: 'newsletter' });
    expect(arrivalOf(null, 'newsletter')).toEqual({ source: null, channel: 'direct', campaign: 'newsletter' });
    expect(originOf(null, 'chatgpt.com')).toBe('chatgpt.com');
    expect(originOf(null, 'newsletter')).toBeNull();
  });

  it('finds the tag on a landing address', () => {
    expect(campaignOf('/?utm_source=ChatGPT.com')).toBe('chatgpt.com');
    expect(campaignOf('/docs?ref=producthunt')).toBe('producthunt');
    expect(campaignOf('/?utm_source=a%20b')).toBeNull();
    expect(campaignOf('/')).toBeNull();
  });
});
