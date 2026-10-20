import { describe, expect, it } from 'vitest';
import { cleanPlace, descriptionPlaces, nominatives, placeNames, titleBase } from './names';

const first = (title: string, lang = '') => placeNames(title, lang)[0];

describe('titleBase', () => {
  it('drops a parenthetical or comma qualifier', () => {
    expect(titleBase('Hastings (Michigan)')).toEqual({ base: 'Hastings', qualified: true });
    expect(titleBase('Hastings, East Sussex')).toEqual({ base: 'Hastings', qualified: true });
    expect(titleBase('Hastings')).toEqual({ base: 'Hastings', qualified: false });
  });
});

describe('placeNames', () => {
  it.each([
    ['Battle of Hastings', 'en', 'hastings', 'battle'],
    ['Second Battle of Ypres', 'en', 'ypres', 'battle'],
    ['Siege of Constantinople (1453)', 'en', 'constantinople', 'siege'],
    ['Treaty of Paris (1783)', 'en', 'paris', 'treaty'],
    ['Attack on Pearl Harbor', 'en', 'pearl harbor', 'attack'],
    ['Srebrenica massacre', 'en', 'srebrenica', 'massacre'],
    ['2008 Mumbai attacks', 'en', 'mumbai', 'attacks'],
    ['Halabja chemical attack', 'en', 'halabja', 'attack'],
    ['Schlacht bei Leuthen', 'de', 'leuthen', 'schlacht'],
    ['Belagerung von Wien', 'de', 'wien', 'belagerung'],
    ["Bataille d'Austerlitz", 'fr', 'austerlitz', 'bataille'],
    ['Siège de La Rochelle', 'fr', 'la rochelle', 'siège'],
    ['Batalla de las Navas de Tolosa', 'es', 'navas de tolosa', 'batalla'],
    ['Battaglia di Legnano', 'it', 'legnano', 'battaglia'],
    ['Malazgirt Meydan Muharebesi', 'tr', 'malazgirt', 'meydan muharebesi'],
    ['Viyana Kuşatması', 'tr', 'viyana', 'kuşatması'],
    ["İstanbul'un Fethi", 'tr', 'istanbul', 'fethi'],
    ['Slaget vid Narva', 'sv', 'narva', 'slaget'],
    ['Slag bij Waterloo', 'nl', 'waterloo', 'slag'],
    ['淞沪会战', 'zh', '淞沪', '会战'],
    ['長篠の戦い', 'ja', '長篠', 'の戦い'],
    ['معركة اليرموك', 'ar', 'اليرموك', 'معركة'],
    ['mohácsi csata', 'hu', 'mohacs', 'csata'],
  ])('%s → %s', (title, lang, norm, head) => {
    const m = first(title, lang);
    expect(m?.norms).toContain(norm);
    expect(m?.head).toBe(head);
  });

  it('turns an inflected Slavic place into likely nominatives', () => {
    expect(first('Битва под Полтавой', 'ru')?.norms).toContain('полтава');
    expect(first('Осада Смоленска', 'ru')?.norms).toContain('смоленск');
    expect(first('Bitwa pod Grunwaldem', 'pl')?.norms).toContain('grunwald');
    expect(first('Bitva u Slavkova', 'cs')?.norms).toContain('slavkov');
    expect(first('Битва под Полтавой', 'ru')?.inflected).toBe(true);
  });

  it('reads the feature a name carries without losing the whole name', () => {
    const m = first('Battle of Bunker Hill', 'en');
    expect(m?.norms).toEqual(['bunker hill', 'bunker']);
    expect(m?.hint).toBe('mountain');
    expect(first('Battle of the Little Bighorn River', 'en')?.hint).toBe('river');
    expect(first('Battle of Cape St. Vincent', 'en')?.norms[0]).toBe('cape st vincent');
  });

  it('tries every language when the title language is unknown', () => {
    expect(first('bataille d\'Ihtiman')?.norms).toContain('ihtiman');
    expect(first('Schlacht von Mollwitz')?.norms).toContain('mollwitz');
  });

  it('finds no place where the title names none', () => {
    expect(placeNames('Bombing of Pan Am Flight 103', 'en')).toEqual([]);
    expect(placeNames('Action of 1 November 1944', 'en')).toEqual([]);
    expect(placeNames('Treaty of Friendship, Commerce and Navigation', 'en')).toEqual([]);
    expect(placeNames('Battle of Britain', 'en').map(m => m.norms[0])).toEqual(['britain']);
    expect(placeNames('Thirty Years\' War', 'en')).toEqual([]);
  });

  it('keeps a comma context apart', () => {
    expect(placeNames('Battle of Lexington, Missouri', 'en').map(m => [m.norms[0], m.head])).toEqual([
      ['lexington', 'battle'],
      ['missouri', 'battle:context'],
    ]);
  });
});

describe('cleanPlace', () => {
  it('strips years and leading articles', () => {
    expect(cleanPlace('the Somme 1916')).toEqual({ name: 'Somme', context: null });
    expect(cleanPlace('Lagos (1759)')).toEqual({ name: 'Lagos', context: null });
  });
});

describe('nominatives', () => {
  it('leaves non-inflected languages alone', () => {
    expect(nominatives('paris', 'en')).toEqual(['paris']);
  });
});

describe('descriptionPlaces', () => {
  it('reads the place and its country from an English description', () => {
    expect(descriptionPlaces('massacre in Bihar, India').map(m => m.norms[0])).toEqual(['bihar', 'india']);
    expect(descriptionPlaces('battle of the Crimean War near Sevastopol').map(m => m.norms[0])).toEqual(['sevastopol']);
    expect(descriptionPlaces('1879 battle')).toEqual([]);
  });
});
