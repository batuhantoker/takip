import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/core/i18n/translator';
import { age, distance, latLng, lightTime, magnitude, speed } from './format';

const de = createTranslator('de', {});

describe('distance', () => {
  it('switches from kilometres to astronomical units', () => {
    expect(distance(6_800)).toBe('6,800 km');
    expect(distance(384_399)).toBe('384,400 km');
    expect(distance(1_500_000)).toBe('1,500,000 km');
    expect(distance(227_900_000)).toBe('1.523 AU');
    expect(distance(25_000_000_000)).toBe('167.1 AU');
    expect(distance(NaN)).toBe('—');
  });

  it('goes on to light-years past the inner Oort cloud', () => {
    expect(distance(3.3e11)).toBe('2,206 AU');
    expect(distance(4.0175e13)).toBe('4.25 ly');
    expect(distance(2.526e17)).toBe('26,700 ly');
    expect(distance(2.4e19)).toBe('2.54 million ly');
    expect(distance(4.283e23)).toBe('45.3 billion ly');
  });
});

describe('lightTime', () => {
  it('reads seconds, minutes and hours', () => {
    expect(lightTime(1.28)).toBe('1.3 s');
    expect(lightTime(499)).toBe('8 min 19 s');
    expect(lightTime(83_640)).toBe('23 h 14 min');
    expect(lightTime(86_400 * 5.8)).toBe('5.8 days');
    expect(lightTime(86_400 * 365.25 * 4.246)).toBe('4.25 years');
  });
});

describe('speed and latLng', () => {
  it('formats with sensible precision', () => {
    expect(speed(1.6562)).toBe('1.66 km/s');
    expect(speed(16.98)).toBe('17.0 km/s');
    expect(latLng(-4.8246, 137.3878)).toBe('4.82°S 137.39°E');
  });

  it('writes numbers the way the page language does', () => {
    expect(distance(25_000_000_000, de)).toBe('167,1 AU');
    expect(speed(16.98, de)).toBe('17,0 km/s');
  });
});

describe('magnitude', () => {
  it('always signs, with a true minus, in the page language', () => {
    expect(magnitude(1.234)).toBe('+1.23');
    expect(magnitude(-1.46)).toBe('−1.46');
    expect(magnitude(0)).toBe('+0.00');
    expect(magnitude(1.234, de)).toBe('+1,23');
    expect(magnitude(NaN)).toBe('—');
  });
});

describe('age', () => {
  it('describes how old a timestamp is', () => {
    const now = Date.parse('2026-10-12T20:00:00Z');
    expect(age('2026-10-12T19:59:00Z', now)).toBe('just now');
    expect(age('2026-10-12T19:02:00Z', now)).toBe('58 min ago');
    expect(age('2026-09-29T15:12:00Z', now)).toBe('13 d ago');
    expect(age(null, now)).toBe('time unknown');
  });
});
