import { describe, expect, it } from 'vitest';
import { eventQuery, isDay, pickArticle } from './wiki';

describe('history wiki lookup', () => {
  it('asks for that day only, around the point', () => {
    const q = eventQuery('2001-09-11', -77.056, 38.871);
    expect(q).toContain('"2001-09-11T00:00:00Z"');
    expect(q).toContain('"2001-09-12T00:00:00Z"');
    expect(q).toContain('Point(-77.056 38.871)');
    expect(isDay('2001-09-11')).toBe(true);
    expect(isDay('2001-9-11')).toBe(false);
  });

  it('takes the nearest hit that reads as violence, and nothing else', () => {
    expect(pickArticle([
      { title: '2001 Arlington county election', dist: 0.5, types: ['election'] },
      { title: 'American Airlines Flight 77', dist: 0.2, types: ['aircraft hijacking', 'suicide attack'] },
      { title: 'September 11 attacks', dist: 30, types: ['coordinated terrorist attack'] },
    ])).toBe('American Airlines Flight 77');
    expect(pickArticle([{ title: 'Some match', dist: 1, types: ['association football match'] }])).toBeNull();
  });
});
