import { describe, expect, it } from 'vitest';
import { brandSpoken } from './voice';

describe('brandSpoken', () => {
  it('spells the brand and its domain one way in English', () => {
    expect(brandSpoken("Scrub through TAKIP's history, free at takip.dev.", 'en'))
      .toBe("Scrub through Tah-kip's history, free at Tah-kip dot dev.");
  });

  it('reads it as the Turkish word in Turkish', () => {
    expect(brandSpoken('TAKIP üzerinde keşfedin: takip.dev', 'tr')).toBe('Takip üzerinde keşfedin: Takip nokta dev');
  });

  it('leaves other languages as written', () => {
    expect(brandSpoken('Entdecken Sie es auf TAKIP.', 'de')).toBe('Entdecken Sie es auf TAKIP.');
  });
});
