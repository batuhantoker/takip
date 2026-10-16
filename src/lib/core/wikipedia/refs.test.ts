import { describe, expect, it } from 'vitest';
import { articleRef, articleUrl, isArticleTitle, refFromUrl } from './refs';

describe('stored Wikipedia references', () => {
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
    expect(articleRef('zh-classical:赤壁之戰')).toEqual({ lang: 'zh-classical', title: '赤壁之戰' });
    expect(articleRef('be-x-old:Бітва')).toEqual({ lang: 'be-x-old', title: 'Бітва' });
    expect(articleRef('Star Wars: Episode IV')).toEqual({ lang: 'en', title: 'Star Wars: Episode IV' });
    expect(articleUrl('pl:Bitwa pod Grunwaldem')).toBe('https://pl.wikipedia.org/wiki/Bitwa_pod_Grunwaldem');
  });

  it('reads an article URL back into a stored title', () => {
    expect(refFromUrl('https://en.wikipedia.org/wiki/History_of_Sumer')).toBe('History of Sumer');
    expect(refFromUrl('https://en.wikipedia.org/wiki/Early_Dynastic_Period_(Egypt)')).toBe('Early Dynastic Period (Egypt)');
    expect(refFromUrl('https://en.wikipedia.org/wiki/Kingdom%20of%20Hawai%CA%BBi')).toBe('Kingdom of Hawaiʻi');
    expect(refFromUrl('https://id.wikipedia.org/wiki/Kesultanan_Sambaliung')).toBe('id:Kesultanan Sambaliung');
    expect(refFromUrl(articleUrl('pl:Bitwa pod Grunwaldem'))).toBe('pl:Bitwa pod Grunwaldem');
    expect(refFromUrl('https://example.com/wiki/Elam')).toBeNull();
    expect(refFromUrl('https://en.wikipedia.org/wiki/%E0%A4%A')).toBeNull();
  });
});
