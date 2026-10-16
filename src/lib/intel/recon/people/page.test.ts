import { describe, expect, it } from 'vitest';
import { nameFromTitle, pageFacts } from './page';

describe('nameFromTitle', () => {
  it('pulls the name out from around the handle and the site', () => {
    expect(nameFromTitle('Linus Torvalds (@torvalds) / X', 'torvalds', 'Twitter')).toBe('Linus Torvalds');
    expect(nameFromTitle('torvalds (Linus Torvalds) · GitHub', 'torvalds', 'GitHub')).toBe('Linus Torvalds');
    expect(nameFromTitle('Ben Halpern - DEV Community', 'ben', 'DEV Community')).toBe('Ben Halpern');
  });

  it('reads the formats real profile titles use', () => {
    expect(nameFromTitle('Chris Coyne (@malgorithms) on X', 'malgorithms', 'Periscope')).toBe('Chris Coyne');
    expect(nameFromTitle('Christopher Coyne | @malgorithms', 'malgorithms', 'Venmo')).toBe('Christopher Coyne');
  });

  it('refuses titles that are only the handle or the site talking', () => {
    expect(nameFromTitle('torvalds - GitHub', 'torvalds', 'GitHub')).toBeUndefined();
    expect(nameFromTitle("malgorithms's Applets", 'malgorithms', 'IFTTT')).toBeUndefined();
    expect(nameFromTitle('User Profile | Forum', 'bob', 'Forum')).toBeUndefined();
    expect(nameFromTitle('Page not found', 'bob', 'Example')).toBeUndefined();
  });
});

describe('pageFacts', () => {
  it('reads a Telegram page’s og tags as the owner’s', () => {
    const html = `<html><head><title>Telegram: Contact @durov</title>
      <meta property="og:title" content="Pavel Durov">
      <meta property="og:image" content="https://cdn4.telesco.pe/file/abc.jpg">
      <meta property="og:description" content="Founder of Telegram."></head></html>`;
    expect(pageFacts(html, 'Telegram', 'durov')).toMatchObject({
      name: 'Pavel Durov', bio: 'Founder of Telegram.', avatar: 'https://cdn4.telesco.pe/file/abc.jpg', via: 'page',
    });
  });

  it('ignores og descriptions and images on ordinary pages, which are usually the site’s', () => {
    const html = `<title>Jane Roe (@jroe) | Example</title>
      <meta property="og:description" content="Example is the best place to share">
      <meta property="og:image" content="https://example.com/brand.png">`;
    const f = pageFacts(html, 'Example', 'jroe');
    expect(f?.name).toBe('Jane Roe');
    expect(f?.bio).toBeUndefined();
    expect(f?.avatar).toBeUndefined();
  });

  it('reads JSON-LD Person, sameAs and rel=me', () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"ProfilePage",
      "mainEntity":{"@type":"Person","name":"Jane Roe","description":"Maker.","sameAs":["https://github.com/jroe"],
      "address":{"addressLocality":"Leeds","addressCountry":"UK"}}}</script>
      <a rel="me nofollow" href="https://mastodon.social/@jroe">m</a>`;
    expect(pageFacts(html, 'Example', 'jroe')).toMatchObject({
      name: 'Jane Roe', bio: 'Maker.', location: 'Leeds, UK',
      links: expect.arrayContaining(['https://github.com/jroe', 'https://mastodon.social/@jroe']),
    });
  });

  it('reads Linktree’s links out of its page data', () => {
    const data = { props: { pageProps: { account: {
      pageTitle: '@jroe', description: 'Links', profilePictureUrl: 'https://ugc.production.linktr.ee/x.jpeg',
      socialLinks: [{ url: 'https://instagram.com/jroe' }],
    }, links: [{ title: 'Site', url: 'https://jroe.dev' }] } } };
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
    const f = pageFacts(html, 'Linktree', 'jroe');
    expect(f?.name).toBeUndefined();
    expect(f?.links).toEqual(['https://instagram.com/jroe', 'https://jroe.dev']);
    expect(f?.avatar).toBe('https://ugc.production.linktr.ee/x.jpeg');
  });

  it('ignores titles that never mention the handle: challenges, consent walls, app shells', () => {
    for (const t of ['Client Challenge', 'Web Player', 'Private Site', 'Just a moment...']) {
      expect(pageFacts(`<title>${t}</title><meta property="og:title" content="${t}">`, 'Example', 'jroe')).toBeUndefined();
    }
  });

  it('drops descriptions that are only the site’s counts', () => {
    const html = `<meta property="og:type" content="profile"><meta property="og:title" content="Jane Roe">
      <meta property="og:description" content="jroe has 11 repositories available. Follow their code on GitHub.">`;
    expect(pageFacts(html, 'GitHub', 'jroe')).toMatchObject({ name: 'Jane Roe', bio: undefined });
  });

  it('drops the site’s own accounts and its profile slogans', () => {
    const html = `<meta property="og:type" content="profile"><meta property="og:title" content="Jane Roe (@jroe)">
      <meta property="og:description" content="Jane Roe (jroe)'s profile on Myspace, the place where people come to connect.">
      <a rel="me" href="https://mastodon.social/@Instapaper">us</a><a rel="me" href="https://github.com/jroe">me</a>`;
    expect(pageFacts(html, 'Instapaper', 'jroe')).toMatchObject({ bio: undefined, links: ['https://github.com/jroe'] });
  });

  it('says nothing for a page with nothing about anyone', () => {
    expect(pageFacts('<title>GitHub</title>', 'GitHub', 'x')).toBeUndefined();
  });
});
