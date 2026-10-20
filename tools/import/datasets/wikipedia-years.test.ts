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
});
