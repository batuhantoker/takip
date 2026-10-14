import { describe, expect, it } from 'vitest';
import { utc } from '../dates';
import { seriesByTest } from './nuclear';

describe('seriesByTest', () => {
  const series = seriesByTest([
    { title: 'Operation Dominic', label: 'Otowi', day: '1962-06-22' },
    { title: 'Operation Hardtack II', label: 'Hardtack Juniper', day: '1958-07-22' },
  ]);

  it('finds a test by its name within a day, bare or after the series name', () => {
    expect(series('OTOWI', utc(1962, 6, 23))).toBe('Operation Dominic');
    expect(series('JUNIPER', utc(1958, 7, 22))).toBe('Operation Hardtack II');
  });

  it('leaves a same-named test on another day alone', () => {
    expect(series('OTOWI', utc(1962, 6, 25))).toBeNull();
    expect(series('BLUESTONE', utc(1962, 6, 22))).toBeNull();
  });
});
