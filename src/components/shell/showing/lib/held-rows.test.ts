import { describe, expect, it } from 'vitest';
import { NOTHING_SEEN, remember, shownGroups } from './held-rows';
import type { ShowingGroup, ShowingRow } from './showing-rows';

const row = (id: string, over: Partial<ShowingRow> = {}): ShowingRow => ({ id, label: id, swatch: { kind: 'layer', key: id }, off: { kind: 'layer', key: id }, ...over });
const group = (id: string, ...rows: ShowingRow[]): ShowingGroup => ({ id, title: id, rows });

describe('held rows', () => {
  it('keeps a switched-off row in place, off, until the panel closes', () => {
    const open = [group('events', row('a'), row('b')), group('layers', row('c'))];
    const seen = remember(NOTHING_SEEN, open);
    const after = [group('events', row('b')), group('layers', row('c'))];
    expect(remember(seen, after)).toBe(seen);
    expect(shownGroups(seen, after)).toEqual([
      { id: 'events', title: 'events', rows: [{ ...row('a'), on: false }, { ...row('b'), on: true }] },
      { id: 'layers', title: 'layers', rows: [{ ...row('c'), on: true }] },
    ]);
  });

  it('adds rows turned on elsewhere, and orders groups as rowsFor does', () => {
    const seen = remember(NOTHING_SEEN, [group('layers', row('c'))]);
    const now = [group('borders', row('w')), group('layers', row('c'))];
    const more = remember(seen, now);
    expect(shownGroups(more, now).map(g => g.id)).toEqual(['borders', 'layers']);
  });

  it('takes the latest data for a row still drawn, and drops a gone row with no switch', () => {
    const seen = remember(NOTHING_SEEN, [group('borders', row('w', { meta: '1914' })), group('areas', row('areas', { off: undefined, value: 2 }))]);
    const shown = shownGroups(seen, [group('borders', row('w', { meta: '1915' }))]);
    expect(shown).toEqual([{ id: 'borders', title: 'borders', rows: [{ ...row('w', { meta: '1915' }), on: true }] }]);
  });
});
