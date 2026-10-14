import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dataLayout } from './layout';
import { SqliteTraceIndex } from './sqlite/trace-index';

const DAY = Date.parse('2026-10-11T00:00:00Z');
const NOW = Date.parse('2026-10-12T20:00:00Z');
const release = { day: DAY, tag: 'v2026.10.11-planes-readsb-prod-0', page: 'https://github.com/x', parts: [{ name: 'v.tar.aa', size: 2_000_000_000, url: 'https://x/aa' }] };

describe('trace index', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'traces-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('finds an aircraft in a day from any time in it, and a reader sees a year file that appears later', () => {
    const layout = dataLayout(dir);
    const reader = new SqliteTraceIndex(layout, 'read');
    expect(reader.entry(DAY, 'ad66e9')).toBeUndefined();

    const writer = new SqliteTraceIndex(layout, 'write', () => NOW);
    writer.putDay(release, [{ icao: 'ad66e9', offset: 1024, size: 3000 }, { icao: '4CA7B5', offset: 1_999_999_000, size: 4000 }]);
    expect(existsSync(layout.traceIndex(DAY))).toBe(true);

    expect(reader.entry(DAY + 13 * 3_600_000, 'AD66E9')).toEqual({ icao: 'ad66e9', offset: 1024, size: 3000, release: { ...release, entries: 2, indexedAt: NOW } });
    expect(reader.entry(DAY, '4ca7b5')?.offset).toBe(1_999_999_000);
    expect(reader.entry(DAY, 'aaaaaa')).toBeUndefined();
    expect(reader.release(DAY + 86_400_000)).toBeUndefined();
    reader.close();
    writer.close();
  });

  it('replaces a day whole when it is indexed again', () => {
    const index = new SqliteTraceIndex(dataLayout(dir), 'write', () => NOW);
    index.putDay(release, [{ icao: 'ad66e9', offset: 1024, size: 3000 }, { icao: '4ca7b5', offset: 9000, size: 10 }]);
    index.putDay({ ...release, tag: 'v2026.10.11-planes-readsb-staging-0' }, [{ icao: 'ad66e9', offset: 2048, size: 3000 }]);
    expect(index.entry(DAY, '4ca7b5')).toBeUndefined();
    expect(index.entry(DAY, 'ad66e9')).toMatchObject({ offset: 2048, release: { tag: 'v2026.10.11-planes-readsb-staging-0', entries: 1 } });
    index.close();
  });

  it('refuses a day that does not start at midnight, an address that is not ICAO, and writes through a reader', () => {
    const index = new SqliteTraceIndex(dataLayout(dir), 'write');
    expect(() => index.putDay({ ...release, day: DAY + 1 }, [])).toThrow(/00:00 UTC/);
    expect(() => index.putDay(release, [{ icao: '~290ee9', offset: 0, size: 1 }])).toThrow(/ICAO/);
    expect(() => new SqliteTraceIndex(dataLayout(dir), 'read').putDay(release, [])).toThrow(/read-only/);
    index.close();
  });
});
