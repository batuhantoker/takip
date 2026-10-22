import { describe, expect, it } from 'vitest';
import { eventWords, sameEvent } from './story-match';

const T = Date.UTC(2026, 9, 22, 12);
const H = 3_600_000;
const sketch = (title: string, ts = T, at: [number, number] | null = null) => ({ words: eventWords(title), ts, at });

describe('the same event in the press and on the wires', () => {
  it('folds two tellings of one event, from a slug or a headline', () => {
    expect(sameEvent(sketch('Indian national among two killed in attack on saudi arabias dammam airport', T, [26.4, 50.1]),
      sketch('Two killed in Houthi attack on airport in eastern Saudi Arabia, authorities say', T + 2 * H, [26.3, 50.2]))).toBe(true);
    expect(sameEvent(sketch('Clavicular streamer rape cape cod ma court'),
      sketch('‘Looksmaxxing’ streamer Clavicular appears in court over Cape Cod rape allegations', T - H))).toBe(true);
  });

  it('keeps apart reports too far apart in time or place, or too short to tell', () => {
    const story = 'Indian national among two killed in attack on saudi arabias dammam airport';
    const wire = 'Two killed in Houthi attack on airport in eastern Saudi Arabia, authorities say';
    expect(sameEvent(sketch(story), sketch(wire, T + 7 * H))).toBe(false);
    expect(sameEvent(sketch(story, T, [26.4, 50.1]), sketch(wire, T, [21.5, 39.2]))).toBe(false);
    expect(sameEvent(sketch('Strikes in Gaza'), sketch('Strikes in Gaza again'))).toBe(false);
  });

  it('needs most of the shorter title, not one shared place name', () => {
    expect(sameEvent(sketch('Paris protesters return to the streets to defy the government ban on demonstrations'),
      sketch('Paris museum reopens its doors after the summer renovation works'))).toBe(false);
  });

  it('reads words without accents, case or a plural s', () => {
    expect([...eventWords('Vučić’s Protests: Students')]).toEqual(['vucic', 'protest', 'student']);
  });
});
