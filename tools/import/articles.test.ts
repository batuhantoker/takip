import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { Articles, sameTime } from './articles';
import { enwikiTitle, otherArticle } from './wiki';

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

describe('article matching', () => {
  it('compares at the coarser precision, a day either side', () => {
    expect(sameTime(day('1995-02-10'), Prec.day, day('1995-02-11'), Prec.day)).toBe(true);
    expect(sameTime(day('1995-02-10'), Prec.day, day('1995-02-12'), Prec.day)).toBe(false);
    expect(sameTime(day('1995-02-10'), Prec.day, day('1995-01-01'), Prec.year)).toBe(true);
    expect(sameTime(day('1995-02-10'), Prec.day, day('1995-01-01'), Prec.month)).toBe(false);
    expect(sameTime(day('1995-02-10'), Prec.day, day('1990-01-01'), Prec.decade)).toBe(false);
  });

  const articles = new Articles({
    events: [
      { title: 'Little Feller (nuclear tests)', cls: 'nuclear test', t: '1962-01-01T00:00:00Z/9', coord: 'Point(-116.3 37.1)' },
      { title: 'Operation Plumbbob', cls: 'nuclear test series', t0: '1957-05-28T00:00:00Z/11', t1: '1957-10-07T00:00:00Z/11', coord: 'Point(-116.0 37.0)' },
      { title: '1906 San Francisco earthquake', cls: 'earthquake', t: '1906-04-18T00:00:00Z/11', coord: 'Point(-122.5 37.75)' },
    ],
    heritage: [{ whs: '76', title: 'Everglades National Park', coord: 'Point(-80.9 25.3)' }],
    volcanoes: [{ gvp: '211060', title: 'Mount Etna' }],
  });
  const nts = { lon: -116, lat: 37 };

  it('skips items dated coarser than asked, and counts a range only for spans', () => {
    expect(articles.event(['nuclear test'], day('1962-07-11'), Prec.day, nts, 300)).toBe('Little Feller (nuclear tests)');
    expect(articles.event(['nuclear test'], day('1962-07-11'), Prec.day, nts, 300, { minPrec: Prec.day })).toBeNull();
    expect(articles.event(['nuclear test series'], day('1957-07-05'), Prec.day, nts, 800)).toBeNull();
    expect(articles.event(['nuclear test series'], day('1957-07-05'), Prec.day, nts, 800, { spans: true })).toBe('Operation Plumbbob');
  });

  it('needs the place as well as the day', () => {
    expect(articles.event(['earthquake'], day('1906-04-18'), Prec.day, { lon: -122.4, lat: 37.8 }, 300)).toBe('1906 San Francisco earthquake');
    expect(articles.event(['earthquake'], day('1906-04-18'), Prec.day, { lon: -70, lat: -33 }, 300)).toBeNull();
  });

  it('finds a heritage site by its name when its points sit far apart, and a volcano by its number', () => {
    expect(articles.heritageAt({ lon: -80.7, lat: 25.6 }, 'Everglades National Park')).toBe('Everglades National Park');
    expect(articles.heritageAt({ lon: -80.7, lat: 25.6 }, 'Somewhere else')).toBeNull();
    expect(articles.volcano(211060)).toBe('Mount Etna');
  });
});

describe('enwiki titles', () => {
  it('reads the title out of an English Wikipedia URL only', () => {
    expect(enwikiTitle('https://en.wikipedia.org/wiki/Battle_of_%C5%81%C3%B3d%C5%BA_(1914)')).toBe('Battle of Łódź (1914)');
    expect(enwikiTitle('https://en.m.wikipedia.org/wiki/Gulf_War#Background')).toBe('Gulf War');
    expect(enwikiTitle('https://www.wikidata.org/wiki/Q1001069')).toBeNull();
    expect(enwikiTitle(undefined)).toBeNull();
  });
  it('takes another Wikipedia in a fixed order, else the first by code', () => {
    expect(otherArticle({ ca: 'Batalla de Lleida', fr: 'Bataille de Lérida', es: 'Batalla de Lérida' })).toBe('fr:Bataille de Lérida');
    expect(otherArticle({ oc: 'Batalha', ca: 'Batalla' })).toBe('ca:Batalla');
    expect(otherArticle({})).toBeNull();
    expect(otherArticle(undefined)).toBeNull();
  });
});
