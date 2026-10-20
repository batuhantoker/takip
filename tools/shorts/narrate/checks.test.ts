import { describe, expect, it } from 'vitest';
import type { Script } from '../scene';
import { scriptProblem } from './script';
import { cer } from './voice';

const en: Script = {
  lang: 'en', kicker: 'Deep time', unit: '{n} million years ago',
  beats: [{ id: 'hook', say: 'Earth in a minute.' }, { id: 'a', say: 'Pangaea splits.', title: 'Pangaea' }],
  ui: { sources: 'Sources', explore: 'Explore it live', bce: 'BCE' }, post: { title: 'T', description: 'D', hashtags: ['#TAKIP'] },
};
const tr: Script = {
  ...en, lang: 'tr', kicker: 'Derin zaman', unit: '{n} milyon yıl önce',
  beats: [{ id: 'hook', say: 'Bir dakikada Dünya.' }, { id: 'a', say: 'Pangea bölünür.', title: 'Pangea' }],
  ui: { sources: 'Kaynaklar', explore: 'Canlı keşfet', bce: 'MÖ' },
};

describe('scriptProblem', () => {
  it('accepts a whole translation', () => {
    expect(scriptProblem(en, tr)).toBeNull();
  });
  it('refuses a dropped or renamed beat, a lost title or a lost {n}', () => {
    expect(scriptProblem(en, { ...tr, beats: tr.beats.slice(1) })).toMatch(/same number/);
    expect(scriptProblem(en, { ...tr, beats: [tr.beats[0], { ...tr.beats[1], id: 'b' }] })).toMatch(/keep id/);
    expect(scriptProblem(en, { ...tr, beats: [tr.beats[0], { id: 'a', say: 'x' }] })).toMatch(/title/);
    expect(scriptProblem(en, { ...tr, unit: 'milyon yıl önce' })).toMatch(/\{n\}/);
  });
});

describe('cer', () => {
  it('is 0 for the same words, ignoring case, punctuation and digits', () => {
    expect(cer('Two hundred million years ago.', 'two hundred million years ago')).toBe(0);
    expect(cer('Hace 200 millones de años', 'hace millones de años')).toBe(0);
  });
  it('rises with garbling', () => {
    expect(cer('すべての大陸はひとつでした', 'すべての大陸はひとつでした')).toBe(0);
    expect(cer('すべての大陸はひとつでした', 'すべてのせいは一つでした')).toBeGreaterThan(0.3);
  });
});
