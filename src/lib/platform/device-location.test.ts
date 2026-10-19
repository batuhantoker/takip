import { describe, expect, it } from 'vitest';
import { noteDeviceLocation, restoreDeviceLocation, takeDeviceLocation } from './device-location';

describe('device location', () => {
  it('sends each fix once, the latest of many, and again after a failed send', () => {
    expect(takeDeviceLocation()).toBeUndefined();
    noteDeviceLocation({ latitude: 39.9, longitude: 32.8, accuracy: 30 });
    noteDeviceLocation({ latitude: 39.91, longitude: 32.81, accuracy: 12 });
    expect(takeDeviceLocation()).toEqual({ lat: 39.91, lon: 32.81, accuracy: 12 });
    expect(takeDeviceLocation()).toBeUndefined();
    restoreDeviceLocation();
    expect(takeDeviceLocation()).toEqual({ lat: 39.91, lon: 32.81, accuracy: 12 });
    noteDeviceLocation({ latitude: 41, longitude: 29 });
    expect(takeDeviceLocation()).toEqual({ lat: 41, lon: 29, accuracy: null });
  });
});
