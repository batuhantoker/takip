import { describe, expect, it } from 'vitest';
import { groupHits, type Hit } from './search-groups';

const hit = (label: string, kind: string): Hit => ({ label, kind, lat: 0, lng: 0, zoom: 10 });

describe('groupHits', () => {
  it('needs no heading when every result is one kind', () => {
    expect(groupHits([hit('Paris', 'city'), hit('Lyon', 'city')])).toEqual([{ title: '', items: [hit('Paris', 'city'), hit('Lyon', 'city')] }]);
  });

  it('orders groups by their best-ranked result and keeps rank inside each', () => {
    const groups = groupHits([hit('Paris', 'city'), hit('Paris', 'region'), hit('Paris, TX', 'city')]);
    expect(groups.map(g => g.title)).toEqual(['Cities and towns', 'Regions']);
    expect(groups[0].items.map(h => h.label)).toEqual(['Paris', 'Paris, TX']);
  });
});
