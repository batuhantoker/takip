import { describe, expect, it } from 'vitest';
import { parseTrack, requestTrack, settleTrack, stopTracking, trackLink, trackStatus, trackedNow } from './track-request';

describe('parseTrack', () => {
  it('reads the three kinds, lowercasing aircraft hex', () => {
    expect(parseTrack('aircraft:4BB1C2')).toEqual({ kind: 'aircraft', id: '4bb1c2' });
    expect(parseTrack('ship:271000001')).toEqual({ kind: 'ship', id: '271000001' });
    expect(parseTrack('satellite:25544')).toEqual({ kind: 'satellite', id: '25544' });
    expect(parseTrack('bus:1')).toBeNull();
    expect(parseTrack('aircraft:')).toBeNull();
    expect(parseTrack(null)).toBeNull();
  });
});

describe('trackLink', () => {
  it('carries the view, the layers and the target', () => {
    expect(trackLink('https://takip.example', { kind: 'aircraft', id: '4bb1c2' }, { lat: 41.0123456, lng: 28.9, zoom: 8 }, 'flights,military'))
      .toBe('https://takip.example/?lat=41.0123&lon=28.9000&zoom=8.00&layers=flights,military&track=aircraft:4bb1c2');
  });
});

describe('the request', () => {
  it('goes from acquiring to tracking, and follows the target', () => {
    requestTrack({ kind: 'ship', id: '271000001' });
    expect(trackStatus()?.status).toBe('acquiring');
    expect(trackedNow()).toBeNull();
    settleTrack('tracking');
    expect(trackStatus()?.status).toBe('tracking');
    expect(trackedNow()).toEqual({ kind: 'ship', id: '271000001' });
    stopTracking();
    expect(trackStatus()).toBeNull();
    expect(trackedNow()).toBeNull();
  });

  it('can end not found, and settles only once', () => {
    requestTrack({ kind: 'aircraft', id: 'ABC123' });
    settleTrack('not-found');
    settleTrack('tracking');
    expect(trackStatus()).toMatchObject({ target: { id: 'abc123' }, status: 'not-found' });
    expect(trackedNow()).toBeNull();
    stopTracking();
  });
});
