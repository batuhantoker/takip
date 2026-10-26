import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/core/i18n/translator';
import { areaItems, nearItems, type NearInputs } from './near-now';

const t = createTranslator('en', {});
const NOW = Date.UTC(2026, 9, 26, 12);
const HOUR = 3600_000;
// Istanbul; 0.1° of latitude is about 11 km.
const AT: [number, number] = [28.98, 41.01];
const north = (km: number) => ({ lat: AT[1] + km / 111.2, lng: AT[0] });

const base: NearInputs = { at: AT, now: NOW, quakes: [], incidents: [], hotspots: [], alerts: [], lightning: null, rain: null };

describe('nearItems', () => {
  it('is empty when nothing is near', () => {
    expect(nearItems({ ...base, quakes: [{ ...north(900), magnitude: 6, time: NOW - HOUR }] }, t)).toEqual([]);
  });

  it('keeps the strongest quake in reach from the last day, and says how far and how long ago', () => {
    const [item] = nearItems({
      ...base,
      quakes: [
        { ...north(20), magnitude: 2.7, time: NOW - HOUR },
        { ...north(150), magnitude: 4.6, time: NOW - 2 * HOUR },
        { ...north(10), magnitude: 5.9, time: NOW - 30 * HOUR },
      ],
    }, t);
    expect(item).toMatchObject({ kind: 'earthquake', title: 'M4.6 earthquake', detail: '150 km · 2 hr. ago' });
    expect(item.path).toMatch(/^\/\?lat=42\.3\d+&lon=28\.98\d+&zoom=8\.00&layers=earthquakes$/);
  });

  it('ranks a severe warning above lightning, and rain last', () => {
    const items = nearItems({
      ...base,
      alerts: [{ ...north(40), title: 'Flood Warning', severity: 'high', expires: new Date(NOW + HOUR).toISOString() }],
      lightning: { at: NOW - 5 * 60_000, nearest: { km: 12, bearing: 90 } },
      rain: { at: NOW, nearest: { km: 3, bearing: 0 } },
    }, t);
    expect(items.map(i => i.kind)).toEqual(['warning', 'lightning', 'rain']);
    expect(items[0].detail).toBe('About 40 km away');
    expect(items[1].detail).toBe('12 km · 5 min. ago');
    expect(nearItems({ ...base, rain: { at: NOW, nearest: { km: 0, bearing: 0 } } }, t)[0].detail).toBe('Here now');
  });

  it('drops expired warnings', () => {
    expect(nearItems({ ...base, alerts: [{ ...north(5), title: 'Old', severity: 'high', expires: new Date(NOW - HOUR).toISOString() }] }, t)).toEqual([]);
  });

  it('names a nearby fire, and falls back to satellite hotspots but never to volcanoes or weak detections', () => {
    expect(nearItems({ ...base, incidents: [{ ...north(30), name: 'Kemer Fire' }] }, t)[0]).toMatchObject({ kind: 'fire', title: 'Kemer Fire' });
    const spot = { date: '2026-10-26', time: '0930' };
    expect(nearItems({ ...base, hotspots: [{ ...north(8), ...spot, type: 'volcano', confidence: 'high' }, { ...north(9), ...spot, type: 'fire', confidence: 'low' }] }, t)).toEqual([]);
    expect(nearItems({ ...base, hotspots: [{ ...north(8), ...spot, type: 'fire', confidence: 'nominal' }] }, t)[0])
      .toMatchObject({ title: 'Fire seen by satellite', detail: '8 km · 3 hr. ago' });
  });

  it('writes miles for a reader who uses them, and keeps at most four lines', () => {
    const items = nearItems({
      ...base,
      alerts: [{ ...north(40), title: 'Wind', severity: 'medium' }],
      quakes: [{ ...north(80), magnitude: 4.1, time: NOW - HOUR }],
      incidents: [{ ...north(50), name: 'A' }],
      lightning: { at: NOW, nearest: { km: 16, bearing: 0 } },
      rain: { at: NOW, nearest: { km: 1, bearing: 0 } },
    }, t.inUnit('mi'));
    expect(items).toHaveLength(4);
    expect(nearItems({ ...base, rain: { at: NOW, nearest: { km: 1, bearing: 0 } }, lightning: { at: NOW, nearest: { km: 16, bearing: 0 } } }, t, 1)).toHaveLength(1);
    expect(items.map(i => i.kind)).not.toContain('rain');
    expect(items.find(i => i.kind === 'lightning')?.detail).toMatch(/^10 mi · /);
  });
});

describe('areaItems', () => {
  // Belgium's box, roughly.
  const box: [number, number, number, number] = [2.5, 49.5, 6.4, 51.5];
  const area = { box, now: NOW, quakes: [], incidents: [], hotspots: [], alerts: [] };

  it('counts what is inside the box and names one of each', () => {
    const items = areaItems({
      ...area,
      alerts: [
        { lat: 50.8, lng: 4.4, title: 'Wind warning', severity: 'medium' },
        { lat: 50.5, lng: 5.6, title: 'Flood warning: Meuse', severity: 'high' },
        { lat: 48.8, lng: 2.3, title: 'Paris', severity: 'high' },
      ],
      quakes: [
        { lat: 50.6, lng: 5.5, magnitude: 2.9, time: NOW - HOUR, place: 'near Liège' },
        { lat: 50.7, lng: 4.0, magnitude: 2.6, time: NOW - HOUR },
      ],
      incidents: [{ lat: 50.1, lng: 5.8, name: 'Hautes Fagnes', sizeHa: 120 }, { lat: 50.2, lng: 5.0, name: 'Small', sizeHa: 2 }],
    }, t);
    expect(items.map(i => [i.kind, i.title, i.detail])).toEqual([
      ['warning', '2 warnings in force', 'Flood warning: Meuse'],
      ['fire', '2 named fires', 'Largest: Hautes Fagnes'],
      ['earthquake', 'M2.9 earthquake', 'near Liège · 1 hr. ago'],
    ]);
  });

  it('crosses the antimeridian, and falls back to satellite fires', () => {
    const items = areaItems({ ...area, box: [170, -50, -175, -30], hotspots: [{ lat: -40, lng: 178, type: 'fire', confidence: 'high', date: '2026-10-26', time: '0100' }] }, t);
    expect(items[0]).toMatchObject({ kind: 'fire', title: '1 fire seen by satellite' });
  });

  it('is empty when nothing is inside', () => {
    expect(areaItems({ ...area, quakes: [{ lat: 0, lng: 0, magnitude: 7, time: NOW }] }, t)).toEqual([]);
  });
});
