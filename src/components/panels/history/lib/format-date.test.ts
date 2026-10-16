import { describe, expect, it } from 'vitest';
import { ago } from './format-date';

describe('ago', () => {
  const now = Date.UTC(2026, 9, 15, 12);
  const DAY = 86_400_000;

  it('counts back to the past', () => {
    expect(ago(Date.UTC(1914, 5, 28), now)).toBe('112 years ago');
    expect(ago(now - 3 * DAY, now)).toBe('3 days ago');
    expect(ago(now - 1.5 * DAY, now)).toBe('yesterday');
    expect(ago(now - 1000, now)).toBe('today');
  });

  it('counts on into the projected future', () => {
    expect(ago(Date.UTC(2060, 0, 1), now)).toBe('in 33 years');
    expect(ago(now + 90 * DAY, now)).toBe('in 2 months');
    expect(ago(now + 1.5 * DAY, now)).toBe('tomorrow');
    expect(ago(now + 1000, now)).toBe('today');
  });
});
