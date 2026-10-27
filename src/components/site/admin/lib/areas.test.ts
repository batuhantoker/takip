import { describe, expect, it } from 'vitest';
import { areaOf, movedTo, tabHref } from './areas';

describe('areaOf', () => {
  it('finds the area of a page and of its detail pages', () => {
    expect(areaOf('/admin')).toBe('home');
    expect(areaOf('/admin/traffic')).toBe('traffic');
    expect(areaOf('/admin/api')).toBe('api');
    expect(areaOf('/admin/users/abc')).toBe('accounts');
    expect(areaOf('/admin/visitors/v1')).toBe('traffic');
  });

  it("doesn't take a path that only starts with an area's name", () => {
    expect(areaOf('/admin/apiary')).toBe('home');
  });
});

describe('movedTo', () => {
  it('sends the old pages to their tabs', () => {
    expect(movedTo('/admin/usage', '')).toBe('/admin/api#traffic');
    expect(movedTo('/admin/reports', '')).toBe('/admin/accounts#reports');
  });

  it('reads the old Analytics tab from the hash', () => {
    expect(movedTo('/admin/analytics', '#visitors')).toBe('/admin/traffic#visitors');
    expect(movedTo('/admin/analytics', '#audience')).toBe('/admin/accounts#growth');
    expect(movedTo('/admin/analytics', '#system')).toBe(tabHref('data', 'system'));
    expect(movedTo('/admin/analytics', '#overview')).toBe('/admin');
    expect(movedTo('/admin/analytics', '')).toBe('/admin');
  });
});
