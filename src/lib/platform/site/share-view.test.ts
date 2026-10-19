import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYERS } from '@/lib/map/layers/defaults';
import { describeView, LAYER_NOUNS } from './share-view';

describe('describeView', () => {
  it('keeps the site title when the link names nothing', () => {
    expect(describeView({}).title).toBeNull();
  });

  it('names the data layers and the nearby city, leaving out the display ones', () => {
    const v = describeView({ layers: 'day_night,sky_stars,earthquakes,maritime', lat: '41.0', lon: '29.0', zoom: '8' });
    expect(v.title).toBe('Ships and earthquakes near Istanbul, live');
    expect(v.at).toEqual({ lat: 41, lon: 29 });
  });

  it('says how many more when there are lots of layers', () => {
    expect(describeView({ layers: 'flights,military,maritime,satellites,earthquakes' }).title).toBe('Flights, military aircraft, and 3 more layers, live');
  });

  it('names a satellite it knows and follows the rest by number', () => {
    expect(describeView({ track: 'satellite:25544', layers: 'satellites' }).title).toBe('Following the ISS live');
    expect(describeView({ track: 'satellite:99999' }).title).toBe('Following satellite 99999 live');
    expect(describeView({ track: 'aircraft:4bb1c2' }).title).toBe('Following aircraft 4BB1C2 live');
  });

  it('ignores what it cannot check', () => {
    const v = describeView({ track: 'person:1', layers: '<script>', lat: '999', lon: '0' });
    expect(v.title).toBeNull();
    expect(v.at).toBeNull();
    expect(v.imageQuery).toBe('');
  });

  it('normalises the image query, so near-identical links share one card', () => {
    const a = describeView({ layers: 'earthquakes', lat: '41.00001', lon: '29.0', zoom: '8.2' }).imageQuery;
    const b = describeView({ layers: 'earthquakes,day_night', lat: '41.0', lon: '29.00002', zoom: '8.4' }).imageQuery;
    expect(a).toBe(b);
  });

  it('only names layers the map has', () => {
    for (const key of Object.keys(LAYER_NOUNS)) expect(DEFAULT_LAYERS).toHaveProperty(key);
  });
});

describe('describeView in other languages', () => {
  it('capitalises with the reader’s own rules', async () => {
    const { createTranslator } = await import('@/lib/core/i18n/translator');
    const tr = createTranslator('tr', { 'internet outages': 'internet kesintileri', '{things}, live': '{things}, canlı' });
    expect(describeView({ layers: 'cf_outages' }, tr).title).toBe('İnternet kesintileri, canlı');
  });
});
