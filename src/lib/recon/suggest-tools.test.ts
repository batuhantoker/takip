import { describe, expect, it } from 'vitest';
import { flatSuggestions, matchNames, profileMode, suggestTools } from './suggest-tools';

const TOOLS = [
  { id: 'dns', label: 'DNS records', aliases: 'dns records mx' },
  { id: 'whois', label: 'Who owns this domain', aliases: 'whois registrar owner' },
  { id: 'scanner', label: 'Port scan', aliases: 'ports nmap' },
  { id: 'phone', label: 'Phone number', aliases: 'phone number carrier' },
  { id: 'fingerprint', label: 'Profile search', aliases: 'fingerprint profiles accounts' },
];

describe('suggestTools', () => {
  it('offers only lookups for something that is clearly a target', () => {
    const groups = suggestTools('example.com', TOOLS);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Looks like a domain');
    expect(groups[0].items.every(i => i.action === 'run')).toBe(true);
  });

  it('puts a tool named like the word first, ahead of username lookups', () => {
    const items = flatSuggestions(suggestTools('whois', TOOLS));
    expect(items[0]).toEqual({ id: 'whois', action: 'open' });
    expect(items.some(i => i.id === 'fingerprint' && i.action === 'run')).toBe(true);
  });

  it('gives nothing for an empty field', () => {
    expect(suggestTools('   ', TOOLS)).toEqual([]);
  });
});

describe('matchNames', () => {
  it('ignores descriptions so a loose word does not pull in everything', () => {
    expect(matchNames('phone', TOOLS).map(t => t.id)).toEqual(['phone']);
  });
});

describe('profileMode', () => {
  it('follows what the query reads as', () => {
    expect(profileMode('ada@example.com')).toBe('email');
    expect(profileMode('+44 20 7946 0958')).toBe('phone');
    expect(profileMode('ada_lovelace')).toBe('username');
  });
});
