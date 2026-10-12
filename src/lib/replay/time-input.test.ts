import { describe, expect, it } from 'vitest';
import { formatTime, HISTORY_START, parseJump } from './time-input';

const iso = (t: number | undefined) => (t === undefined ? undefined : new Date(t).toISOString());

describe('parseJump', () => {
  it('reads years, months, days and times as UTC', () => {
    expect(iso(parseJump('1916'))).toBe('1916-01-01T00:00:00.000Z');
    expect(iso(parseJump('2003-03'))).toBe('2003-03-01T00:00:00.000Z');
    expect(iso(parseJump('2003-03-20'))).toBe('2003-03-20T00:00:00.000Z');
    expect(iso(parseJump(' 2003-03-20 14:30 '))).toBe('2003-03-20T14:30:00.000Z');
    expect(iso(parseJump('476 AD'))).toBe('0476-01-01T00:00:00.000Z');
  });

  it('reads BCE years, written out or as negatives', () => {
    expect(new Date(parseJump('500 BCE')!).getUTCFullYear()).toBe(-499);
    expect(parseJump('-500')).toBe(parseJump('500 BC'));
    expect(parseJump('10000 BCE')).toBe(HISTORY_START);
  });

  it('refuses what is not a time', () => {
    for (const s of ['', 'yesterday', '2003-13', '2003-02-40', '12:00']) expect(parseJump(s)).toBeUndefined();
  });
});

describe('formatTime', () => {
  it('shows seconds for short spans, dates for long ones, and BCE years alone', () => {
    const t = Date.parse('2003-03-20T14:30:05Z');
    expect(formatTime(t, 86_400_000)).toBe('20 Mar 2003 14:30:05 UTC');
    expect(formatTime(t, 100 * 365 * 86_400_000)).toBe('20 Mar 2003');
    expect(formatTime(parseJump('500 BCE')!, 86_400_000)).toBe('500 BCE');
  });
});
