import { describe, expect, it } from 'vitest';
import { actorNames, splitActors, WAR_MATCHES } from './ucdp';

describe('ucdp helpers', () => {
  it('splits actor lists except inside parentheses', () => {
    expect(splitActors('CPP, Military faction (forces of Honasan, Abenina & Zumel)')).toEqual(['CPP', 'Military faction (forces of Honasan, Abenina & Zumel)']);
    expect(splitActors('APCLS, CNPSC')).toEqual(['APCLS', 'CNPSC']);
  });

  it('pins actor ids to names across rows, leaving co-occurring pairs ambiguous', () => {
    const { known, ambiguous } = actorNames([
      { ids: ['1160'], names: ['M23'] },
      { ids: ['1160', '1200', '4286'], names: ['APCLS', 'Forces of Paul Joseph Mukungubila', 'M23'] },
      { ids: ['1200', '3043'], names: ['APCLS', 'CNPSC'] },
      { ids: ['1200'], names: ['APCLS'] },
      { ids: ['317', '318'], names: ['KCP', 'PREPAK'] },
    ]);
    expect(Object.fromEntries(known)).toEqual({ 1160: 'M23', 1200: 'APCLS', 4286: 'Forces of Paul Joseph Mukungubila', 3043: 'CNPSC' });
    expect(Object.fromEntries(ambiguous)).toEqual({ 317: ['KCP', 'PREPAK'], 318: ['KCP', 'PREPAK'] });
  });
});

describe('ucdp links', () => {
  it('keys each side by source, lists a link once, and makes a conflict same_as at most one war', () => {
    for (const [from, , to] of WAR_MATCHES) for (const key of [from, to]) expect(key).toMatch(/^(ucdp:\d+|wac:CNF-\d{4}|cow:\d+)$/);
    const links = WAR_MATCHES.map(([from, rel, to]) => `${from} ${rel} ${to}`);
    expect(new Set(links).size).toBe(links.length);
    const same = WAR_MATCHES.filter(m => m[1] === 'same_as').map(m => m[0]);
    expect(new Set(same).size).toBe(same.length);
  });
});
