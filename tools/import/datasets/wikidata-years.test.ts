import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { textYear } from './wikidata-years';

const year = (text: string, as: 'description' | 'label' = 'description', battle = false) => textYear(text, as, battle, 2026);

describe('years stated in a description', () => {
  it('reads a leading year, one in brackets, after "in" or a month', () => {
    expect(year('1858 treaty')).toEqual({ from: 1858, prec: Prec.year });
    expect(year('350 battle')).toEqual({ from: 350, prec: Prec.year });
    expect(year('uprising against regent Sima Shi (255)')).toEqual({ from: 255, prec: Prec.year });
    expect(year('revolt against the Ottoman Empire in 1688')).toEqual({ from: 1688, prec: Prec.year });
    expect(year('battle fought in 1645 during the English Civil War')).toEqual({ from: 1645, prec: Prec.year });
    expect(year('battle which occurred on 14 October 1066')).toEqual({ from: 1066, prec: Prec.year });
    expect(year('A treaty signed on November 3, 1978')).toEqual({ from: 1978, prec: Prec.year });
    expect(year('1863')).toEqual({ from: 1863, prec: Prec.year });
  });

  it('reads ranges, and counts BCE years astronomically', () => {
    expect(year('1991–1994 civil war in Djibouti')).toEqual({ from: 1991, to: 1994, prec: Prec.year });
    expect(year('conflict of 1790–1811')).toEqual({ from: 1790, to: 1811, prec: Prec.year });
    expect(year('battle of the 1843–44 war in Peru')).toBeNull();
    expect(year('war (1843–44)')).toEqual({ from: 1843, to: 1844, prec: Prec.year });
    expect(year('conflict between Sparta and the Chalcidian League (382–379 BC)')).toEqual({ from: -381, to: -378, prec: Prec.year });
    expect(year('rebellion in Brazil between 1832 and 1835')).toEqual({ from: 1832, to: 1835, prec: Prec.year });
  });

  it("leaves a battle's longer range to its war", () => {
    expect(year('battle of the Second Punic War (218–201 BC)', 'description', true)).toBeNull();
    expect(year('Battle in Rajasthan between 1222 and 1229', 'description', true)).toBeNull();
    expect(year('2009–2010 shooting in Niger', 'description', true)).toEqual({ from: 2009, to: 2010, prec: Prec.year });
  });

  it('takes no counts, numbered hills or years of something else', () => {
    expect(year('massacre of 1200 Jews')).toBeNull();
    expect(year('1200 soldiers killed in an ambush')).toBeNull();
    expect(year('battle in the 2022 Russian invasion of Ukraine')).toBeNull();
    expect(year('Free trade area since 2010')).toBeNull();
    expect(year('battle of the 101st Airborne')).toBeNull();
    expect(year('battle for Hill 3234 in 1988')).toEqual({ from: 1988, prec: Prec.year });
    expect(year('treaty that ended a war in 2999')).toBeNull();
  });

  it('falls back to a century or a decade', () => {
    expect(year('12th-century battle in Southern India')).toEqual({ from: 1150, prec: Prec.century });
    expect(year('battle of the 5th century BC')).toEqual({ from: -449, prec: Prec.century });
    expect(year('1920s border conflict')).toEqual({ from: 1920, prec: Prec.decade });
  });
});

describe('years stated in a label', () => {
  it('reads brackets, a leading or closing year, a month, and year words', () => {
    expect(year('Liberation of Albania (1918)', 'label')).toEqual({ from: 1918, prec: Prec.year });
    expect(year('2012 Dera Ismail Khan bombing', 'label')).toEqual({ from: 2012, prec: Prec.year });
    expect(year('Treaty between Tunis and Sweden 1736', 'label')).toEqual({ from: 1736, prec: Prec.year });
    expect(year('Moscow-Novgorod War of 1456', 'label')).toEqual({ from: 1456, prec: Prec.year });
    expect(year('Battle of Sokalem (August 1920)', 'label')).toEqual({ from: 1920, prec: Prec.year });
    expect(year('attaque au couteau du 15 octobre 2023 à Hartlepool', 'label')).toEqual({ from: 2023, prec: Prec.year });
    expect(year('Мианкальское восстание 1821–1825 годов', 'label')).toEqual({ from: 1821, to: 1825, prec: Prec.year });
    expect(year('Беловодский мятеж (1918)', 'label')).toEqual({ from: 1918, prec: Prec.year });
  });

  it('takes no numbered places or terms in force', () => {
    expect(year('Battle of Height 776', 'label')).toBeNull();
    expect(year('Battle for Hill 1062', 'label')).toBeNull();
    expect(year('Operation 1027', 'label')).toBeNull();
    expect(year('Danish Defence Agreement 2013–17', 'label')).toBeNull();
    expect(year('12th-century battle', 'label')).toBeNull();
  });
});
