import { describe, expect, it } from 'vitest';
import { clauseCut, opensWithBreak } from './headline';

const NK = 'Throughout the decade, North Korea expanded its nuclear capabilities, performing alleged nuclear tests in 2013 and 2016, which governments responded by placing international sanctions on the country';

describe('clauseCut', () => {
  it('cuts at the last break that fits', () => {
    expect(clauseCut(NK, 160)).toBe('Throughout the decade, North Korea expanded its nuclear capabilities, performing alleged nuclear tests in 2013 and 2016');
    expect(clauseCut(NK, 70)).toBe('Throughout the decade, North Korea expanded its nuclear capabilities');
    expect(clauseCut('Corée du Sud : des manifestations sont organisées contre la dictature de Park Chung-hee à Pusan ; la loi martiale est proclamée', 110))
      .toBe('Corée du Sud : des manifestations sont organisées contre la dictature de Park Chung-hee à Pusan');
    expect(clauseCut('The battle ends in a draw – both armies withdraw from the field before the winter sets in', 60)).toBe('The battle ends in a draw');
  });

  it('never cuts inside brackets, a number or a time', () => {
    const consuls = 'Консулы: Тиберий (в 4-й раз) и Друз Младший (во 2-й раз, оба — патриции); консулы-суффекты: Гней Тремеллий (плебей)';
    expect(clauseCut(consuls, 85)).toBe('Консулы: Тиберий (в 4-й раз) и Друз Младший (во 2-й раз, оба — патриции)');
    expect(clauseCut('An army of 3,000 men lands at 10:30 on the island and marches inland toward the capital city', 80)).toBeNull();
  });

  it('cuts Chinese, Japanese and Arabic at their own commas', () => {
    expect(clauseCut('周恩來、賀龍、葉挺、朱德、劉伯承率領北伐軍2萬餘人在南昌舉行武裝起義，參加起義部隊有朱德第九軍軍官教導團', 36)).toBe('周恩來、賀龍、葉挺、朱德、劉伯承率領北伐軍2萬餘人在南昌舉行武裝起義');
    expect(clauseCut('احتجاجات لمناصري أنتيفا في واشنطن العاصمة ويصرحون بأن الشوارع صارت لهم، تظاهرهم جاء بسبب', 80)).toBe('احتجاجات لمناصري أنتيفا في واشنطن العاصمة ويصرحون بأن الشوارع صارت لهم');
  });

  it('says whether the rest of a line opens with a break', () => {
    expect(opensWithBreak(', performing alleged nuclear tests')).toBe(true);
    expect(opensWithBreak(' : des manifestations')).toBe(true);
    expect(opensWithBreak('，參加起義部隊')).toBe(true);
    expect(opensWithBreak(' by Ottoman forces in 1576')).toBe(false);
  });
});
