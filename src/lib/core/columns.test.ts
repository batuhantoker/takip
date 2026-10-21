import { describe, expect, it } from 'vitest';
import { fromColumns, isColumns, toColumns } from './columns';

describe('rows as columns', () => {
  const rows = [
    { id: 'a', kind: 'cargo', speed: 12.5, moored: false, note: null },
    { id: 'b', kind: 'cargo', speed: 0, moored: true },
    { id: 'c', kind: 'tanker', speed: 9, moored: false, extra: 'only here' },
  ];

  it('gives back every row with the same keys and values', () => {
    const wire = JSON.parse(JSON.stringify(toColumns(rows)));
    expect(isColumns(wire)).toBe(true);
    expect(fromColumns(wire)).toEqual(rows);
  });

  it('stores a key with few values as a dictionary, and a key only some rows have with their indexes', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, kind: i % 2 ? 'cargo' : 'tanker', ...(i === 7 ? { flag: 'TR' } : {}) }));
    const c = toColumns(many);
    const col = (key: string) => c.cols[c.keys.indexOf(key)];
    expect(col('kind').dict).toEqual(['tanker', 'cargo']);
    expect(col('id').dict).toBeUndefined();
    expect(col('flag')).toEqual({ v: [0], dict: ['TR'], at: [7] });
    expect(fromColumns(c)).toEqual(many);
  });

  it('refuses nested values rather than mangling them', () => {
    expect(() => toColumns([{ id: 'a', pos: { lat: 1 } }])).toThrow(/primitive/);
  });
});
