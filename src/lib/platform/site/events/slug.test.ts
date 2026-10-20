import { describe, expect, it } from 'vitest';
import { baseSlug, isSlug, keySuffix, slugWords, yearPart } from './slug';

describe('event slugs', () => {
  it('fold titles to ASCII words', () => {
    expect(slugWords('Battle of Novšiće')).toBe('battle-of-novsice');
    expect(slugWords('1999 İzmit earthquake')).toBe('1999-izmit-earthquake');
    expect(slugWords('Treaty of Brest-Litovsk (1918)')).toBe('treaty-of-brest-litovsk-1918');
    expect(slugWords('Accord de paix entre l’Italie et l’Égypte')).toBe('accord-de-paix-entre-litalie-et-legypte');
    expect(slugWords('Битва при Бородине')).toBe('');
  });

  it('end in the start year, BCE marked, unless the title already starts or ends with it', () => {
    expect(yearPart(1915)).toBe('1915');
    expect(yearPart(-479)).toBe('480-bce');
    expect(yearPart(0)).toBe('1-bce');
    expect(baseSlug('Battle of Salamis', -479, 'Battle')).toBe('battle-of-salamis-480-bce');
    expect(baseSlug('Battle of Adrianople', 378, 'Battle')).toBe('battle-of-adrianople-378');
    expect(baseSlug('1999 İzmit earthquake', 1999, 'Earthquake')).toBe('1999-izmit-earthquake');
    expect(baseSlug('Siege of Vienna (1683)', 1683, 'Siege')).toBe('siege-of-vienna-1683');
  });

  it('fall back to the kind where the title has no Latin letters, so a slug is never a bare number', () => {
    expect(baseSlug('Битва при Бородине', 1812, 'Battle')).toBe('battle-1812');
    expect(baseSlug('1918', 1918, 'Treaty')).toBe('treaty-1918');
    expect(baseSlug(null, 2001, 'Terrorist attack')).toBe('terrorist-attack-2001');
    expect(isSlug('1918')).toBe(false);
    expect(isSlug('treaty-1918')).toBe(true);
  });

  it('cut long titles at a word', () => {
    const slug = baseSlug('Agreement between the Government of the United Kingdom and the Government of the Republic of Ireland', 1998, 'Treaty');
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*-1998$/);
  });

  it('suffix collisions from the event’s own key', () => {
    expect(keySuffix('gtd:200109110004')).toBe(keySuffix('gtd:200109110004'));
    expect(keySuffix('gtd:200109110004')).not.toBe(keySuffix('gtd:200109110005'));
    expect(keySuffix('gtd:1', 8)).toHaveLength(8);
  });
});
