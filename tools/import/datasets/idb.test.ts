import { describe, expect, it } from 'vitest';
import { SOURCES } from '../seed';
import { IDB_METRICS, lastEstimates, projectionOf } from './idb';

describe('idb', () => {
  it('reads each country’s last revision, the US’s starred year as its first projection', () => {
    const html = '<table><tr><th>GENC-2</th><th>Country Name</th><th>Last E&amp;P Revision</th></tr>'
      + '<tr><td>TR</td><td>Turkey</td><td>2015</td></tr><tr><td><p>US</p></td><td>United States</td><td><p>2025 *</p></td></tr></table>';
    expect([...lastEstimates(html)]).toEqual([['TR', 2015], ['US', 2024]]);
  });

  it('keeps projections under their own codes', () => {
    for (const m of IDB_METRICS) expect(projectionOf(m)).toMatchObject({ code: `${m.code}.proj`, attrs: { projection: true, base: m.code } });
    expect(projectionOf(IDB_METRICS[0]).name).toBe('Population (US Census projection)');
  });

  it('is seeded as CC0 under the Census Bureau', () => {
    expect(SOURCES.find(s => s.code === 'census-idb')).toMatchObject({ owner: 'U.S. Census Bureau', licence: 'cc0-1.0' });
  });
});
