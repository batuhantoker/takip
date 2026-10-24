import { describe, expect, it } from 'vitest';
import { flightStep } from './flights';

const launch = { jd: 2443392.04, lat: 28.58, lng: -80.58, pad: 'Cape Canaveral SLC-41', vehicle: 'Titan IIIE / Centaur' };

describe('flightStep', () => {
  it('reads back the labels history/collect.ts writes', () => {
    expect(flightStep({ jd: 1, kind: 'launch', label: 'Launch · Titan IIIE / Centaur from Cape Canaveral SLC-41' }, { launch }))
      .toEqual({ kind: 'launch', jd: launch.jd, pad: launch.pad, vehicle: launch.vehicle });
    expect(flightStep({ jd: 2, kind: 'flyby', label: 'Jupiter flyby · 348,101 km' }, {})).toEqual({ kind: 'flyby', jd: 2, body: 'jupiter', km: 348_101 });
    expect(flightStep({ jd: 3, kind: 'arrival', label: 'Arrives at Moon' }, {})).toEqual({ kind: 'arrival', jd: 3, body: 'moon' });
    expect(flightStep({ jd: 4, kind: 'landing', label: 'Lands on the Moon' }, {})).toEqual({ kind: 'landing', jd: 4, body: 'moon' });
    expect(flightStep({ jd: 5, kind: 'crossing', label: 'Crosses the heliopause · 121.6 AU' }, {})).toEqual({ kind: 'crossing', jd: 5, shell: 'heliopause', au: 121.6 });
    expect(flightStep({ jd: 6, kind: 'launch', label: 'Ephemeris begins' }, {})).toEqual({ kind: 'begins', jd: 6 });
    expect(flightStep({ jd: 7, kind: 'end', label: 'Ephemeris ends' }, {})).toEqual({ kind: 'ends', jd: 7 });
  });

  it('drops the present moment and labels it does not know', () => {
    expect(flightStep({ jd: 8, kind: 'now', label: 'Now' }, {})).toBeNull();
    expect(flightStep({ jd: 9, kind: 'flyby', label: 'Vulcan flyby · 10 km' }, {})).toBeNull();
  });
});
