import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { utc } from '../dates';
import { agreementTitle, distinctive, matchTreaties } from './pax';

describe('agreementTitle', () => {
  it('keeps the English name when a translation is run on', () => {
    expect(agreementTitle('Political Agreement between the National Government and M-19ProcessSpanish: Acuerdo Político entre el Gobierno'))
      .toBe('Political Agreement between the National Government and M-19Process');
    expect(agreementTitle('Agreement\r\n on  Ceasefire')).toBe('Agreement on Ceasefire');
  });

  it('cuts a very long name at a word', () => {
    const t = agreementTitle(`Peace Agreement ${'word '.repeat(60)}`);
    expect(t.length).toBeLessThanOrEqual(201);
    expect(t.endsWith(' word…')).toBe(true);
  });
});

describe('matchTreaties', () => {
  const pax = [
    { id: '10', t: utc(1997, 12, 2), title: 'Agreement between the National Committee on Chittagong Hill Tracts and the PCJSS' },
    { id: '11', t: utc(1996, 12, 29), title: 'Agreement on a Firm and Lasting Peace' },
    { id: '12', t: utc(1996, 12, 29), title: 'Agreement on the Implementation, Compliance and Verification Timetable' },
    { id: '13', t: utc(2010, 4, 21), title: 'Joint Statement (April 21 2010)' },
  ];

  it('links on a shared distinctive word or the whole name, within a day', () => {
    const { pairs } = matchTreaties(pax, [
      { id: 1, title: 'Traité des Chittagong Hill Tracts de 1997', t: utc(1997, 12, 2), prec: Prec.day },
      { id: 2, title: 'Agreement on a Firm and Lasting Peace', t: utc(1996, 12, 29), prec: Prec.day },
    ]);
    expect(pairs).toEqual([['10', 1], ['11', 2]]);
  });

  it('leaves a same-day treaty with nothing in common alone, and a year-dated one', () => {
    const { pairs } = matchTreaties(pax, [
      { id: 3, title: 'Kharkiv Pact', t: utc(2010, 4, 21), prec: Prec.day },
      { id: 4, title: 'Chittagong Hill Tracts Peace Accord', t: utc(1997), prec: Prec.year },
    ]);
    expect(pairs).toEqual([]);
  });

  it('drops the words every agreement has', () => {
    expect([...distinctive('Comprehensive Peace Agreement between the Government of the Republic of the Sudan')]).toEqual(['sudan']);
  });
});
