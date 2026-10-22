import { describe, expect, it } from 'vitest';
import { formatMessage, formatParts, messageVariables } from './message';
import { createTranslator, roundMiles } from './translator';

const PLURAL = '{n, plural, =0 {No layers} one {# layer} other {# layers}}';

describe('formatMessage', () => {
  it('fills variables and formats numbers for the locale', () => {
    expect(formatMessage('{who} saw {n} ships', { who: 'Ada', n: 12345 }, 'en')).toBe('Ada saw 12,345 ships');
    expect(formatMessage('{n} gemi', { n: 12345 }, 'tr')).toBe('12.345 gemi');
  });

  it('leaves a missing variable visible', () => {
    expect(formatMessage('Hello {name}', {}, 'en')).toBe('Hello {name}');
  });

  it('chooses the plural form, exact matches first', () => {
    expect(formatMessage(PLURAL, { n: 0 }, 'en')).toBe('No layers');
    expect(formatMessage(PLURAL, { n: 1 }, 'en')).toBe('1 layer');
    expect(formatMessage(PLURAL, { n: 1200 }, 'en')).toBe('1,200 layers');
  });

  it("uses Russian's three forms", () => {
    const ru = '{n, plural, one {# слой} few {# слоя} many {# слоёв} other {# слоя}}';
    expect([1, 3, 5, 21, 22, 25].map(n => formatMessage(ru, { n }, 'ru'))).toEqual(['1 слой', '3 слоя', '5 слоёв', '21 слой', '22 слоя', '25 слоёв']);
  });

  it("uses Arabic's six forms, with Latin digits under -u-nu-latn", () => {
    const ar = '{n, plural, zero {لا طبقات} one {طبقة واحدة} two {طبقتان} few {# طبقات} many {# طبقة} other {# طبقة}}';
    expect([0, 1, 2, 3, 11, 100].map(n => formatMessage(ar, { n }, 'ar-u-nu-latn')))
      .toEqual(['لا طبقات', 'طبقة واحدة', 'طبقتان', '3 طبقات', '11 طبقة', '100 طبقة']);
  });

  it('selects by value and nests variables in branches', () => {
    const m = '{kind, select, ship {Ship {name}} plane {Flight {name}} other {Track}}';
    expect(formatMessage(m, { kind: 'plane', name: 'TK1' }, 'en')).toBe('Flight TK1');
    expect(formatMessage(m, { kind: 'train' }, 'en')).toBe('Track');
  });

  it('keeps # literal outside a plural', () => {
    expect(formatMessage('Track #{id}', { id: 4 }, 'en')).toBe('Track #4');
  });
});

describe('formatParts', () => {
  it('keeps values that are not text', () => {
    const link = { link: true };
    expect(formatParts('Data from {source}, live', { source: link }, 'en')).toEqual(['Data from ', link, ', live']);
  });
});

describe('messageVariables', () => {
  it('lists variables at any depth', () => {
    expect(messageVariables('{a} {n, plural, one {# {b}} other {# {c}}}')).toEqual(['a', 'b', 'c', 'n']);
    expect(messageVariables('Plain')).toEqual([]);
  });
});

describe('context keys', () => {
  it('show their English without the context and fall back to the plain key', async () => {
    const { createTranslator } = await import('./translator');
    const t = createTranslator('tr', { Layers: 'Katmanlar', 'rail|More': 'Diğer', More: 'Daha fazla' });
    expect(t('rail|Layers')).toBe('Katmanlar');
    expect(t('rail|More')).toBe('Diğer');
    expect(createTranslator('en', {})('rail|Layers')).toBe('Layers');
    expect(createTranslator('en', {})('Map | Space')).toBe('Map | Space');
  });
});

describe('distances', () => {
  const en = createTranslator('en', {});
  const tr = createTranslator('tr', { '{n} km': '{n} km', '{n} mi': '{n} mil' });

  it('writes kilometres, or miles where the place reads them, with a decimal under ten', () => {
    expect(en('{km, distance} away', { km: 14 })).toBe('14 km away');
    expect(en.inUnit('mi')('{km, distance} away', { km: 14 })).toBe('8.7 mi away');
    expect(en.inUnit('mi')('{km, distance} away', { km: 2410 })).toBe('1,498 mi away');
    expect(tr.inUnit('mi')('{km, distance}', { km: 13 })).toBe('8,1 mil');
  });

  it('rounds a radius in miles as people would say it, and leaves kilometres as they are', () => {
    expect(en.inUnit('mi')('within {km, radius}', { km: 100 })).toBe('within 60 mi');
    expect(en.inUnit('mi')('within {km, radius}', { km: 31 })).toBe('within 20 mi');
    expect(en.inUnit('mi')('under {km, radius}', { km: 10 })).toBe('under 6 mi');
    expect(en('within {km, radius}', { km: 30 })).toBe('within 30 km');
    expect([7.5, 19.3, 62, 93, 186, 620].map(roundMiles)).toEqual([8, 20, 60, 90, 190, 600]);
  });

  it('counts a distance as one of the message’s variables, and keeps the unit it was made with', () => {
    expect(messageVariables('{n} cameras within {km, radius} of {city}')).toEqual(['city', 'km', 'n']);
    const mi = en.inUnit('mi');
    expect([mi.distance, mi.inUnit('mi') === mi, en.inUnit('km') === en]).toEqual(['mi', true, true]);
  });
});
