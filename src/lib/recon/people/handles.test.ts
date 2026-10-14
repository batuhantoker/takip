import { describe, expect, it } from 'vitest';
import { emailsInText, htmlToText, parseHandle, profileKey, urlsInText } from './handles';

describe('profileKey', () => {
  it('gives one key to every spelling of a profile', () => {
    const github = ['https://www.github.com/Octocat', 'https://github.com/octocat/', 'github.com/octocat'];
    expect(new Set(github.map(profileKey))).toEqual(new Set(['github:octocat']));
    expect(profileKey('https://twitter.com/jack')).toBe(profileKey('https://x.com/Jack'));
    expect(profileKey('https://news.ycombinator.com/user?id=pg')).toBe('hackernews:pg');
    expect(profileKey('https://bsky.app/profile/jay.bsky.social')).toBe('bluesky:jay');
    expect(profileKey('https://mastodon.social/@Gargron')).toBe('fedi:mastodon.social:gargron@mastodon.social');
  });

  it('keeps Sherlock’s own profile URLs on the same keys as links to them', () => {
    expect(profileKey('https://lichess.org/@/thibault')).toBe('lichess:thibault');
    expect(profileKey('https://www.chess.com/member/hikaru')).toBe('chess:hikaru');
    expect(profileKey('https://hub.docker.com/u/someone/')).toBe('dockerhub:someone');
    expect(profileKey('http://en.gravatar.com/beau')).toBe('gravatar:beau');
  });

  it('falls back to host and path for anything else', () => {
    expect(profileKey('https://www.Example.com/About/')).toBe('url:example.com/about');
    expect(profileKey('not a url at all')).toBeNull();
  });
});

describe('parseHandle', () => {
  it('refuses the site’s own pages', () => {
    expect(parseHandle('https://github.com/features')).toBeNull();
    expect(parseHandle('https://x.com/home')).toBeNull();
    expect(parseHandle('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('reads handles from subdomains and queries', () => {
    expect(parseHandle('https://someone.substack.com/')).toMatchObject({ platform: 'substack', handle: 'someone' });
    expect(parseHandle('https://www.tumblr.com/')).toBeNull();
  });
});

describe('text helpers', () => {
  it('finds links written with and without a scheme', () => {
    const urls = urlsInText('Code at github.com/octocat, blog https://octo.dev. Also (https://x.com/octo)');
    expect(urls).toEqual(expect.arrayContaining(['https://github.com/octocat', 'https://octo.dev', 'https://x.com/octo']));
  });

  it('keeps real addresses and drops no-reply and image names', () => {
    expect(emailsInText('mail me: Jane.Doe@Roe.dev, logo@2x.png, you@example.com, 123+bot@users.noreply.github.com'))
      .toEqual(['jane.doe@roe.dev']);
  });

  it('turns markup into text', () => {
    expect(htmlToText('<p>Hi &amp; welcome<br>to <a href="x">my</a> page</p>')).toBe('Hi & welcome\nto my page');
  });
});
