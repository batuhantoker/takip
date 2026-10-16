import { describe, expect, it } from 'vitest';
import { correlate, type ProfileInput } from './correlate';
import { emptyFacts, type ProfileFacts } from './facts';
import { dhashFromPixels, hamming } from './photo-hash';

const facts = (f: Partial<ProfileFacts>): ProfileFacts => ({ ...emptyFacts('api'), ...f });

describe('correlate', () => {
  it('groups profiles that verify, link and resemble each other, and grades how', () => {
    const profiles: ProfileInput[] = [
      { site: 'Keybase', url: 'https://keybase.io/jroe', facts: facts({ name: 'Jane Roe', verified: ['https://github.com/jroe'] }) },
      { site: 'GitHub', url: 'https://www.github.com/jroe', facts: facts({ name: 'Jane Roe', location: 'Leeds', links: ['https://x.com/jroe'], website: 'https://jroe.dev' }) },
      { site: 'DEV Community', url: 'https://dev.to/jroe', facts: facts({ name: 'Jane A. Roe', website: 'https://jroe.dev/' }) },
      { site: 'Lichess', url: 'https://lichess.org/@/jroe', facts: facts({ name: 'Jane Roe' }) },
      { site: 'Reddit', url: 'https://www.reddit.com/user/jroe' },
      { site: 'Chess', url: 'https://www.chess.com/member/jroe', facts: facts({ name: 'Mark Smith' }) },
    ];
    const { matches, identity } = correlate('jroe', profiles);

    expect(matches.Keybase).toEqual({ tier: 'confirmed', reasons: ['Verifies GitHub', 'Same name as GitHub, DEV Community, Lichess'] });
    expect(matches.GitHub.tier).toBe('confirmed');
    expect(matches.GitHub.reasons[0]).toBe('Verified by Keybase');
    expect(matches['DEV Community'].tier).toBe('likely');
    expect(matches['DEV Community'].reasons).toContain('Same website as GitHub');
    expect(matches.Lichess.tier).toBe('likely');
    expect(matches.Reddit.tier).toBe('unknown');
    expect(matches.Chess).toEqual({ tier: 'other', reasons: ['Different name: Mark Smith'] });

    expect(identity.tied).toBe(true);
    expect(identity.cluster.slice(0, 2)).toEqual(['Keybase', 'GitHub']);
    expect(identity.names[0]).toEqual({ value: 'Jane Roe', sites: ['Keybase', 'GitHub', 'DEV Community', 'Lichess'] });
    expect(identity.websites[0].sites).toEqual(['GitHub', 'DEV Community']);
    // X was linked but the sweep didn't confirm it, so it's offered as an account to look at.
    expect(identity.accounts).toEqual([{ label: 'X', handle: 'jroe', url: 'https://x.com/jroe', sites: ['GitHub'], verified: false }]);
  });

  it('keeps a second group that ties only to itself apart from the main one', () => {
    const { matches } = correlate('sam', [
      { site: 'A', url: 'https://a.example/sam', facts: facts({ verified: ['https://b.example/sam'] }) },
      { site: 'B', url: 'https://b.example/sam' },
      { site: 'C', url: 'https://c.example/sam', facts: facts({ name: 'Sam Lee' }) },
      { site: 'D', url: 'https://d.example/sam', facts: facts({ name: 'Sam Lee' }) },
    ]);
    expect(matches.A.tier).toBe('confirmed');
    expect(matches.C.tier).toBe('other');
    expect(matches.C.reasons[0]).toBe('Tied to D, not to the main group');
  });

  it('does not treat a display name that is just the handle as evidence', () => {
    const { matches, identity } = correlate('jane_roe', [
      { site: 'A', url: 'https://a.example/jane_roe', facts: facts({ name: 'jane_roe' }) },
      { site: 'B', url: 'https://b.example/jane_roe', facts: facts({ name: 'Jane Roe' }) },
    ]);
    expect(matches.A.tier).toBe('unknown');
    expect(identity.tied).toBe(false);
    expect(identity.names).toEqual([]);
  });

  it('matches a short first name to its long form, but not a different surname', () => {
    const { matches } = correlate('cc', [
      { site: 'A', url: 'https://a.example/cc', facts: facts({ name: 'Chris Coyne' }) },
      { site: 'B', url: 'https://b.example/cc', facts: facts({ name: 'Christopher Coyne' }) },
      { site: 'C', url: 'https://c.example/cc', facts: facts({ name: 'Chris Coyle' }) },
    ]);
    expect(matches.A.tier).toBe('likely');
    expect(matches.B.tier).toBe('likely');
    expect(matches.C).toEqual({ tier: 'other', reasons: ['Different name: Chris Coyle'] });
  });

  it('ties two profiles with the same photo', () => {
    const { matches } = correlate('x', [
      { site: 'A', url: 'https://a.example/x', photo: 'f0f0f0f0f0f0f0f0' },
      { site: 'B', url: 'https://b.example/x', photo: 'f0f0f0f0f0f0f0f1' },
      { site: 'C', url: 'https://c.example/x', photo: '0f0f0f0f0f0f0f0f' },
    ]);
    expect(matches.A).toEqual({ tier: 'likely', reasons: ['Same photo as B'] });
    expect(matches.C.tier).toBe('unknown');
  });
});

describe('photo hash', () => {
  it('hashes a gradient, refuses a flat image, and counts differing bits', () => {
    const gradient = Uint8Array.from({ length: 72 }, (_, i) => 255 - (i % 9) * 28);
    expect(dhashFromPixels(gradient)).toBe('ffffffffffffffff');
    expect(dhashFromPixels(new Uint8Array(72).fill(128))).toBeNull();
    expect(hamming('ff00', 'ff01')).toBe(1);
    expect(hamming('ffffffffffffffff', '0000000000000000')).toBe(64);
  });
});
