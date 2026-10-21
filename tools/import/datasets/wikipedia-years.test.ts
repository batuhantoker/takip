import { describe, expect, it } from 'vitest';
import { titleOf } from './wikipedia-years';

describe('titleOf', () => {
  it('keeps the first sentence, not stopping at abbreviations', () => {
    expect(titleOf('U.S. Secretary of State John Hay announces the Open Door Policy. It promotes trade.')).toBe('U.S. Secretary of State John Hay announces the Open Door Policy');
    expect(titleOf('St. Petersburg is founded by Peter I. Swedes object.')).toBe('St. Petersburg is founded by Peter I. Swedes object');
    expect(titleOf('签订条约。随后开战。')).toBe('签订条约。');
    expect(titleOf('Восстание в Милете против персов. К нему присоединяются города.')).toBe('Восстание в Милете против персов');
    expect(titleOf('III. Guido yendi. Sonra taç giydi.')).toBe('III. Guido yendi');
    expect(titleOf('Am 3. Mai stirbt Friedrich II. in Wien. Danach Krieg.')).toBe('Am 3. Mai stirbt Friedrich II. in Wien');
  });

  it('cuts a long sentence at a word', () => {
    const t = titleOf(`${'word '.repeat(60)}end.`);
    expect(t.length).toBeLessThanOrEqual(161);
    expect(t.endsWith('word…')).toBe(true);
  });

  it('cuts a long sentence at its last clause that fits, Chinese and Japanese sooner', () => {
    expect(titleOf('Throughout the decade, North Korea expanded its nuclear capabilities, performing alleged nuclear tests in 2013 and 2016, which governments responded by placing international sanctions on the country. In response North Korea has threatened the United States.'))
      .toBe('Throughout the decade, North Korea expanded its nuclear capabilities, performing alleged nuclear tests in 2013 and 2016');
    const zh = '周恩來、賀龍、葉挺、朱德、劉伯承率領北伐軍2萬餘人在南昌舉行武裝起義，參加起義部隊有朱德第九軍軍官教導團和南昌公安局2個警察隊，賀龍之第二十軍，葉挺之第二十四師和蔡廷鍇之第十師等。';
    expect(titleOf(zh, 'zh')).toBe('周恩來、賀龍、葉挺、朱德、劉伯承率領北伐軍2萬餘人在南昌舉行武裝起義，參加起義部隊有朱德第九軍軍官教導團和南昌公安局2個警察隊，賀龍之第二十軍');
    expect(titleOf(zh)).toBe(zh);
    const ja = 'テッサリアで行われたキュノスケファライの戦いで前執政官ティトゥス・クィンクティウス・フラミニヌスに率いられたローマ軍はピリッポス5世に対して決定的な勝利を収めマケドニアの覇権が終わった。';
    expect(titleOf(ja, 'ja')).toBe(ja);
  });
});
