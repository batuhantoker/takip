import { describe, expect, it } from 'vitest';
import { chokepointFlowFeatures, chokepointFlowPopupHtml, sparkline, type ChokepointFlowRow } from './chokepoint-flow';

const HORMUZ: ChokepointFlowRow = {
  id: 'chokepoint6', name: 'Strait of Hormuz', lat: 26.6, lng: 56.4, latestDate: '2026-10-04',
  last7Mean: 1.2, baselineMean: 8, ratio: 0.151, basis: 'capacity', status: 'disrupted',
  series: [{ date: '2026-10-03', total: 3, tanker: 1, cargo: 2 }, { date: '2026-10-04', total: 2, tanker: 0, cargo: 2 }],
  disruptionIds: ['portwatch-1'],
};
const RED = { id: 'portwatch-1', name: 'HORMUZ-26', typeLabel: 'Conflict', alertLevel: 'RED', fromDate: '2026-03-01T00:00:00.000Z', active: true, source: 'https://portwatch.imf.org/' };

describe('chokepointFlowFeatures', () => {
  it('flags a strait under an active red disruption whatever its ratio says', () => {
    const [f] = chokepointFlowFeatures([{ ...HORMUZ, status: 'normal', ratio: 1 }], [RED]);
    expect(f.properties).toMatchObject({ color: '#FF6D00', status: 'normal' });
  });

  it('colours by status when nothing is linked', () => {
    expect(chokepointFlowFeatures([HORMUZ])[0].properties?.color).toBe('#FF1744');
  });
});

describe('chokepointFlowPopupHtml', () => {
  it('states the ratio, its basis, the data date and the linked disruption', () => {
    const html = chokepointFlowPopupHtml(chokepointFlowFeatures([HORMUZ], [RED])[0].properties ?? {});
    expect(html).toContain('15% of its previous ~90 days (tanker tonnage)');
    expect(html).toContain('to 2026-10-04');
    expect(html).toContain('HORMUZ-26 · since 2026-03-01');
  });

  it('does not rate a strait with too little history', () => {
    const html = chokepointFlowPopupHtml(chokepointFlowFeatures([{ ...HORMUZ, status: 'insufficient', ratio: null }])[0].properties ?? {});
    expect(html).toContain('Too little history');
  });
});

describe('sparkline', () => {
  it('needs two points', () => {
    expect(sparkline([1], '#fff')).toBe('');
    expect(sparkline([0, 2], '#fff')).toContain('polyline');
  });
});
