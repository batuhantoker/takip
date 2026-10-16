import { describe, expect, it } from 'vitest';
import { parseBluesky, parseDevto, parseGithub, parseGravatar, parseHackerNews, parseKeybase, parseLichess, parseMastodon } from './extract';

// Trimmed from the platforms' real answers for their own public example accounts.

describe('API extractors', () => {
  it('Keybase: live proofs are verified links; revoked ones are dropped', () => {
    const f = parseKeybase({ them: [{
      basics: { ctime: 1391653108 },
      profile: { full_name: 'Chris Coyne', location: 'Maine', bio: 'I love making things.' },
      pictures: { primary: { url: 'https://s3.amazonaws.com/keybase_processed_uploads/4c7c_360_360.jpg' } },
      proofs_summary: { all: [
        { proof_type: 'twitter', state: 1, service_url: 'https://twitter.com/malgorithms' },
        { proof_type: 'github', state: 1, service_url: 'https://github.com/malgorithms' },
        { proof_type: 'reddit', state: 2, service_url: 'https://reddit.com/user/malgorithms' },
      ] },
    }] });
    expect(f).toMatchObject({ name: 'Chris Coyne', location: 'Maine', joined: '2014-02-06', via: 'api' });
    expect(f!.verified).toEqual(['https://twitter.com/malgorithms', 'https://github.com/malgorithms']);
  });

  it('Gravatar: verified accounts, minus hidden ones', () => {
    const f = parseGravatar({
      display_name: 'Beau Lebens', profile_url: 'https://gravatar.com/beau', location: 'Golden, CO',
      avatar_url: 'https://0.gravatar.com/avatar/2720', description: 'Lead of WooCommerce.',
      verified_accounts: [
        { service_type: 'github', url: 'https://github.com/beaulebens', is_hidden: false },
        { service_type: 'twitter', url: 'https://x.com/beaulebens', is_hidden: true },
      ],
    });
    expect(f).toMatchObject({ name: 'Beau Lebens', location: 'Golden, CO', avatar: 'https://0.gravatar.com/avatar/2720?d=404&s=256' });
    expect(f!.verified).toEqual(['https://github.com/beaulebens']);
    expect(f!.links).toContain('https://gravatar.com/beau');
  });

  it('Mastodon: only fields with verified_at are verified, and mentions aren’t links', () => {
    const f = parseMastodon({
      display_name: 'Eugen Rochko', url: 'https://mastodon.social/@Gargron', created_at: '2016-03-16T00:00:00.000Z',
      avatar: 'https://files.mastodon.social/accounts/avatars/000/000/001/original/6b23.png',
      note: '<p>Founder of <a href="https://mastodon.social/@Mastodon" class="u-url mention">@Mastodon</a>.</p>',
      fields: [
        { name: 'GitHub', value: '<a href="https://github.com/Gargron" rel="me">github.com/Gargron</a>', verified_at: '2023-02-07T23:24:40.347+00:00' },
        { name: 'Blog', value: '<a href="https://blog.example">blog</a>', verified_at: null },
      ],
    });
    expect(f.name).toBe('Eugen Rochko');
    expect(f.bio).toBe('Founder of @Mastodon.');
    expect(f.verified).toEqual(['https://github.com/Gargron']);
    expect(f.links).toEqual(['https://blog.example']);
  });

  it('DEV: the GitHub and X names come from sign-in, so they count as verified', () => {
    const f = parseDevto({ name: 'Ben Halpern', twitter_username: 'bendhalpern', github_username: 'benhalpern', summary: 'A developer.', location: 'NY', website_url: 'http://benhalpern.com', joined_at: 'Dec 27, 2015' });
    expect(f.verified).toEqual(['https://github.com/benhalpern', 'https://x.com/bendhalpern']);
    expect(f.website).toBe('http://benhalpern.com');
  });

  it('Bluesky: a custom-domain handle is a verified website', () => {
    expect(parseBluesky({ handle: 'jay.bsky.team', displayName: 'Jay 🦋', description: 'Founder' }).verified).toEqual(['https://jay.bsky.team']);
    expect(parseBluesky({ handle: 'someone.bsky.social', displayName: 'S' }).verified).toEqual([]);
  });

  it('GitHub: X handle, social accounts and public email', () => {
    const f = parseGithub(
      { login: 'octocat', name: 'The Octocat', blog: 'https://github.blog', location: 'San Francisco', email: 'octo@octo.dev', twitter_username: 'octo', created_at: '2011-01-25T18:44:36Z', avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4' },
      [{ provider: 'linkedin', url: 'https://www.linkedin.com/in/octo' }],
    );
    expect(f.links).toEqual(['https://x.com/octo', 'https://www.linkedin.com/in/octo']);
    expect(f.emails).toEqual(['octo@octo.dev']);
    expect(f.joined).toBe('2011-01-25');
  });

  it('Lichess and Hacker News', () => {
    expect(parseLichess({ createdAt: 1290415680000, profile: { realName: 'Thibault Duplessis', links: 'https://github.com/ornicar https://x.com/ornicar' } }))
      .toMatchObject({ name: 'Thibault Duplessis', links: ['https://github.com/ornicar', 'https://x.com/ornicar'] });
    expect(parseHackerNews({ id: 'pg', created: 1160418092, about: 'Bug fixer. <a href="https://paulgraham.com">site</a> pg@pg.dev' }))
      .toMatchObject({ links: ['https://paulgraham.com'], emails: ['pg@pg.dev'] });
  });
});
