import { describe, expect, it } from 'vitest';
import { BASE_LAYERS, mapHref } from './map-link';

describe('mapHref', () => {
  it('names the base display layers, so the link does not open on a bare globe', () => {
    const url = new URL(mapHref({ layers: ['earthquakes'], view: { lat: 35.68, lon: 139.69, zoom: 5 } }), 'http://x');
    expect(url.searchParams.get('layers')!.split(',')).toEqual([...BASE_LAYERS, 'earthquakes']);
    expect(url.searchParams.get('lat')).toBe('35.6800');
    expect(url.searchParams.get('zoom')).toBe('5.00');
  });

  it('drops unknown layer keys and keeps the track readable', () => {
    const href = mapHref({ layers: ['satellites', 'nonsense'], track: 'satellite:25544' });
    expect(href).not.toContain('nonsense');
    expect(href).toContain('track=satellite:25544');
  });

  it('keeps the visitor’s own layers when it names none', () => {
    expect(mapHref({ layers: [] })).toBe('/');
    expect(mapHref({ layers: [], mode: { view: 'history', year: 1914 } })).toBe('/?view=history&year=1914');
    expect(mapHref({ layers: [], panel: 'route' })).toBe('/?panel=route');
  });
});
