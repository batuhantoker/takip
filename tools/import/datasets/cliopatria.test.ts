import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Geometry, Position } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { DIR, memberOf, mergeRows, readRows, wikiUrl } from './cliopatria';

const square = (x: number) => [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]];
const row = (props: Record<string, unknown>, x = 0) => ({ properties: props, geometry: { type: 'Polygon', coordinates: square(x) } });

const file = existsSync(DIR) ? readdirSync(DIR).find(f => f.endsWith('.geojson')) : undefined;

function inside([x, y]: number[], g: Geometry) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const inRing = (ring: Position[]) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[j];
      if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
    }
    return c;
  };
  return polys.some(p => inRing(p[0]) && !p.slice(1).some(inRing));
}

describe('cliopatria', () => {
  it('keeps the widest whole a polity belongs to', () => {
    expect(memberOf('(Holy Roman Empire);(Kingdom of Bohemia)')).toBe('Holy Roman Empire');
    expect(memberOf('(British Empire)')).toBe('British Empire');
    expect(memberOf('')).toBeNull();
  });

  it('links Wikipedia titles', () => {
    expect(wikiUrl('Ottoman Empire')).toBe('https://en.wikipedia.org/wiki/Ottoman_Empire');
    expect(wikiUrl('id.wikipedia.org/wiki/Kesultanan_Sambaliung')).toBe('https://id.wikipedia.org/wiki/Kesultanan_Sambaliung');
    expect(wikiUrl(null)).toBeNull();
  });

  it('drops unions drawn over their members', () => {
    const rejects: string[] = [];
    const rows = readRows([
      row({ Name: '(British Empire)', FromYear: 1900, ToYear: 1904, Components: 'British Raj' }),
      row({ Name: 'British Raj', FromYear: 1900, ToYear: 1904, MemberOf: '(British Empire)', Wikipedia: 'British Raj', Wikidata: 'Q129286' }),
      { properties: { Name: 'Nowhere', FromYear: 1900, ToYear: 1901 }, geometry: null },
    ], reason => rejects.push(reason));
    expect(rejects).toEqual(['a union of polities drawn over its members', 'not a polygon']);
    expect(rows.map(r => [r.props.name, r.props.subject, r.props.wikidata])).toEqual([['British Raj', 'British Empire', 'Q129286']]);
  });

  it('joins a polity’s consecutive rows while its shape holds', () => {
    const rows = readRows([
      row({ Name: 'Republic of Turkey', FromYear: 1924, ToYear: 1935 }),
      row({ Name: 'Republic of Turkey', FromYear: 1936, ToYear: 1938 }),
      row({ Name: 'Republic of Turkey', FromYear: 1939, ToYear: 1944 }, 1),
      row({ Name: 'Republic of Turkey', FromYear: 1946, ToYear: 1946 }, 1),
    ], () => {});
    expect(mergeRows(rows).map(r => [r.from, r.to])).toEqual([[1924, 1938], [1939, 1944], [1946, 1946]]);
  });

  it.skipIf(!file)('reads the published file: Hatay joins Turkey in 1939', () => {
    const rows = readRows(JSON.parse(readFileSync(join(DIR, file!), 'utf8')).features, () => {});
    const holder = (x: number, y: number, year: number) => rows.filter(r => r.from <= year && year <= r.to && inside([x, y], r.geom)).map(r => r.props.name);
    expect(holder(36.16, 36.2, 1925)).toEqual(['French Mandate for Syria and Lebanon']);
    expect(holder(36.16, 36.2, 1940)).toEqual(['Republic of Turkey']);
    expect(holder(27.14, 38.42, 1921)).toEqual(['First Hellenic Republic']);
    expect(rows.find(r => r.props.name === 'British Raj')?.props.subject).toBe('British Empire');
  }, 60_000);
});
