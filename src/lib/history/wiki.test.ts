import { describe, expect, it } from 'vitest';
import { articleRef, articleUrl, eventQuery, isArticleTitle, isDay, pickArticle } from './wiki';

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

  it('takes a stored title, not a path, a query or a link', () => {
    expect(isArticleTitle('Cenepa War')).toBe(true);
    expect(isArticleTitle("Barrios' War of Reunification")).toBe(true);
    expect(isArticleTitle('Russo-Ukrainian war (2022–present)')).toBe(true);
    expect(isArticleTitle('')).toBe(false);
    expect(isArticleTitle('../../etc')).toBe(false);
    expect(isArticleTitle('Gulf War#Background')).toBe(false);
    expect(isArticleTitle('a|b')).toBe(false);
  });

  it('reads a wiki code before the title, and only a lowercase one', () => {
    expect(articleRef('Cenepa War')).toEqual({ lang: 'en', title: 'Cenepa War' });
    expect(articleRef('fr:Crise séparatiste des Comores')).toEqual({ lang: 'fr', title: 'Crise séparatiste des Comores' });
    expect(articleRef('zh-yue:二戰')).toEqual({ lang: 'zh-yue', title: '二戰' });
    expect(articleRef('Star Wars: Episode IV')).toEqual({ lang: 'en', title: 'Star Wars: Episode IV' });
    expect(articleUrl('pl:Bitwa pod Grunwaldem')).toBe('https://pl.wikipedia.org/wiki/Bitwa_pod_Grunwaldem');
  });
});
