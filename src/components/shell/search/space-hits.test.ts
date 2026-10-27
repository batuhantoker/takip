import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/core/i18n/translator';
import { spaceHits } from './space-hits';

const t = createTranslator('en', {});

describe('space search', () => {
  it('finds a nebula by a word of its name and flies to its picture', () => {
    const [hit] = spaceHits('pillars', t);
    expect(hit.label).toBe('Pillars of Creation');
    expect(hit.select).toEqual({ kind: 'feature', id: 'pillars-of-creation' });
  });

  it('sends a Local Group galaxy to its own feature', () => {
    expect(spaceHits('andromeda', t)[0].select).toEqual({ kind: 'feature', id: 'm31' });
  });

  it('ranks a planet that starts with the words over a match inside a name', () => {
    expect(spaceHits('mars', t)[0]).toMatchObject({ label: 'Mars', focus: 'mars', select: { kind: 'body', key: 'mars' } });
  });

  it('finds spacecraft, accents and case aside', () => {
    expect(spaceHits('VOYAGER', t).some(h => h.select.kind === 'craft')).toBe(true);
    expect(spaceHits('bootes', t).length + spaceHits('laniakea', t).length).toBeGreaterThan(0);
  });

  it('stays quiet for one letter', () => {
    expect(spaceHits('m', t)).toEqual([]);
  });
});
