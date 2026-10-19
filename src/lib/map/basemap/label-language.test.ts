import { describe, expect, it } from 'vitest';
import { localizeTextField } from './label-language';

const tr = (name: string) => ['coalesce', ['get', 'name:tr'], ['get', name]];

describe('localizeTextField', () => {
  it('leaves English alone', () => {
    expect(localizeTextField('{name_en}', 'en')).toBe('{name_en}');
  });

  it('prefers the reader\'s name over a bare token', () => {
    expect(localizeTextField('{name_en}', 'tr')).toEqual(tr('name_en'));
    expect(localizeTextField('{name}', 'tr')).toEqual(tr('name'));
    expect(localizeTextField('{housenumber}', 'tr')).toBe('{housenumber}');
  });

  it('turns a legacy zoom function into a step', () => {
    expect(localizeTextField({ stops: [[8, '{name_en}'], [13, '{name}']] }, 'tr'))
      .toEqual(['step', ['zoom'], tr('name_en'), 13, tr('name')]);
  });

  it('rewrites name reads inside expressions, Simplified Chinese first', () => {
    expect(localizeTextField(['format', '● ', {}, ['get', 'name'], {}], 'zh'))
      .toEqual(['format', '● ', {}, ['coalesce', ['get', 'name:zh-Hans'], ['get', 'name:zh'], ['get', 'name']], {}]);
    expect(localizeTextField(['get', 'iata'], 'tr')).toEqual(['get', 'iata']);
  });
});
