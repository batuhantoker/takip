import { describe, expect, it } from 'vitest';
import { parseLinkPreview } from './parse';

const page = (head: string) => `<!doctype html><html><head>${head}</head><body><meta property="og:title" content="Body tag"></body></html>`;

describe('parseLinkPreview', () => {
  it('reads Open Graph tags in any attribute order and decodes entities', () => {
    const p = parseLinkPreview(page(`
      <meta content="Police say &quot;no threat&quot; after Akron shooting" property="og:title">
      <meta property='og:description' content='It&#39;s the second this week.'>
      <meta property="og:image" content="/img/lead.jpg?w=1200&amp;h=630">
      <meta property="og:site_name" content="Cleveland 19">`), 'https://www.cleveland19.com/2026/10/20/story/');
    expect(p).toEqual({
      url: 'https://www.cleveland19.com/2026/10/20/story/',
      title: 'Police say "no threat" after Akron shooting',
      description: 'It\'s the second this week.',
      image: 'https://www.cleveland19.com/img/lead.jpg?w=1200&h=630',
      site: 'Cleveland 19',
    });
  });

  it('falls back to Twitter tags, the document title and the host name', () => {
    const p = parseLinkPreview(page(`
      <title>Stark County stabbing | WKYC</title>
      <meta name="twitter:description" content="A teenager died.">
      <meta name="twitter:image" content="https://cdn.example.com/a.jpg">`), 'https://www.wkyc.com/article/1');
    expect(p.title).toBe('Stark County stabbing | WKYC');
    expect(p.description).toBe('A teenager died.');
    expect(p.image).toBe('https://cdn.example.com/a.jpg');
    expect(p.site).toBe('wkyc.com');
    expect(parseLinkPreview(page('<meta property="og:image" content="http://cdn.example.com/b.jpg">'), 'http://example.com/a').image)
      .toBe('https://cdn.example.com/b.jpg');
  });

  it('drops the site name the title ends with', () => {
    const p = parseLinkPreview(page('<meta property="og:title" content="UK to deploy Typhoon jets | Dunya News"><meta property="og:site_name" content="Dunya News">'), 'https://dunyanews.tv/en/1');
    expect(p.title).toBe('UK to deploy Typhoon jets');
  });

  it('reads only the head, and refuses pictures that are not web addresses', () => {
    const p = parseLinkPreview(page('<meta property="og:image" content="javascript:alert(1)">'), 'https://example.com/a');
    expect(p.title).toBeNull();
    expect(p.image).toBeNull();
  });

  it('clips a long description at a word and leaves out one that repeats the title', () => {
    const long = parseLinkPreview(page(`<meta name="description" content="${'word '.repeat(100)}">`), 'https://example.com/a');
    expect(long.description!.length).toBeLessThanOrEqual(321);
    expect(long.description!.endsWith('word…')).toBe(true);
    const same = parseLinkPreview(page('<meta property="og:title" content="Same"><meta property="og:description" content="Same">'), 'https://example.com/a');
    expect(same.description).toBeNull();
  });
});
