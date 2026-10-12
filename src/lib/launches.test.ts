import { describe, expect, it } from 'vitest';
import { formatNet, padFeatures, type LaunchRow } from './launches';

const base: LaunchRow = {
  id: 'll2-a', name: 'Falcon 9 Block 5 | Starlink Group 15-25', net: '2026-10-13T00:11:44Z', precision: 'Second',
  status: 'Go', status_name: 'Go for Launch', provider: 'SpaceX', pad_id: 'll2-pad-16', pad: 'Space Launch Complex 4E',
  location: 'Vandenberg SFB, CA, USA', lat: 34.632, lng: -120.611, webcast_live: false, url: 'https://ll.thespacedevs.com/2.2.0/launch/a/',
};

describe('formatNet', () => {
  it('shows a date only as precisely as LL2 knows it', () => {
    expect(formatNet('2026-10-13T00:11:44Z', 'Second')).toBe('13 Oct 2026 00:11 UTC');
    expect(formatNet('2026-10-13T00:11:44Z', 'Day')).toBe('13 Oct 2026');
    expect(formatNet('2026-11-30T00:00:00Z', 'Month')).toBe('Nov 2026');
    expect(formatNet('2026-12-31T00:00:00Z', 'Quarter 4')).toBe('Q4 2026');
    expect(formatNet('2027-06-30T00:00:00Z', 'Half 1')).toBe('H1 2027');
    expect(formatNet('2027-12-31T00:00:00Z', 'Year')).toBe('2027');
    expect(formatNet('not a date', 'Second')).toBe('TBD');
  });
});

describe('padFeatures', () => {
  it('puts one pin on each pad, led by its next launch', () => {
    const later = { ...base, id: 'll2-b', name: 'Falcon 9 Block 5 | Starlink Group 17-9', net: '2026-11-30T00:00:00Z', precision: 'Month', status: 'TBD' };
    const elsewhere = { ...base, id: 'll2-c', net: '2026-10-20T12:00:00Z', pad_id: 'll2-pad-80', pad: 'Space Launch Complex 40', lat: 28.56, lng: -80.57 };
    const features = padFeatures([later, elsewhere, base]);
    expect(features).toHaveLength(2);
    expect(features[0].properties).toMatchObject({ name: base.name, count: 2, when: '13 Oct 2026 00:11 UTC', status: 'Go' });
    expect(JSON.parse(features[0].properties.later)).toEqual([{ name: later.name, when: 'Nov 2026' }]);
    expect(features[1].geometry.coordinates).toEqual([-80.57, 28.56]);
  });
});
