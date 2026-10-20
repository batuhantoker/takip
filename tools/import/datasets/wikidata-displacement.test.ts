import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import type { Row } from './wikidata';
import { wdPlace } from './wikidata-conflict';
import { origins } from './wikidata-displacement';

const row = (fields: Partial<Row>): Row => ({ item: 'Q1', classes: 'Q379693', ...fields });

describe('wikidata expulsions', () => {
  it('places a deportation at its start point before its country, and says so', () => {
    const r = row({ fromCoord: 'Point(-85.3 35.0)', countryCoord: 'Point(-98 39)' });
    expect(wdPlace(r, origins([r]).get('Q1'))).toEqual({ lon: -85.3, lat: 35, geoPrec: GeoPrec.area, placedAt: 'start of its route' });
  });

  it('keeps its own location first', () => {
    const r = row({ locCoord: 'Point(34 45)', fromCoord: 'Point(43 43)' });
    expect(wdPlace(r, origins([r]).get('Q1'))).toEqual({ lon: 34, lat: 45, geoPrec: GeoPrec.area });
  });
});
