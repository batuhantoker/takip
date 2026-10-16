import { describe, it, expect } from 'vitest';
import { MAX_AREA_KM, areaAround, areaLabel, areaOfBox, areaOfShape, bboxSize, samplePoints, samplesIn, searchPolygon } from './area';

describe('imagery area', () => {
  it('builds a square of the asked size around a point', () => {
    const a = areaAround(41, 29, 50);
    expect(a.widthKm).toBeCloseTo(50, 0);
    expect(a.heightKm).toBeCloseTo(50, 0);
    expect(a.center.lat).toBeCloseTo(41, 6);
    expect(areaLabel(a)).toBe('50 × 50 km');
  });

  it('cuts a view wider than one search to its middle', () => {
    const a = areaOfBox([20, 35, 45, 45]);
    expect(a.clamped).toBe(true);
    expect(a.widthKm).toBeCloseTo(MAX_AREA_KM, 0);
    expect(a.heightKm).toBeCloseTo(MAX_AREA_KM, 0);
    expect(a.center).toEqual({ lat: 40, lng: 32.5 });
    expect(areaOfBox([28.5, 40.8, 29.5, 41.3]).clamped).toBeUndefined();
  });

  it('brings a view that runs past 180° back onto the globe', () => {
    // Centred on -177.5 and cut at the antimeridian rather than wrapped.
    const a = areaOfBox([175, -40, 190, -35]);
    expect(a.bbox[0]).toBe(-180);
    expect(a.bbox[2]).toBeCloseTo(-177.5 + 250 / (111.32 * Math.cos(37.5 * Math.PI / 180)), 6);
  });

  it('searches a drawn shape by its box and samples only inside it', () => {
    // A triangle: half its box.
    const shape: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[29, 41], [29.4, 41], [29, 41.4], [29, 41]]] };
    const a = areaOfShape(shape);
    expect(a.bbox).toEqual([29, 41, 29.4, 41.4]);
    expect(searchPolygon(a).coordinates[0]).toHaveLength(5);
    const inside = samplePoints(a).length, all = samplePoints({ ...a, shape: undefined }).length;
    expect(inside / all).toBeGreaterThan(0.4);
    expect(inside / all).toBeLessThan(0.6);
  });

  it('finds the samples inside a footprint', () => {
    const a = areaAround(0, 0, 100);
    const samples = samplePoints(a, 4);
    const east: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[0, -1], [1, -1], [1, 1], [0, 1], [0, -1]]] };
    expect(samplesIn(east, samples)).toHaveLength(8);
    expect(samplesIn(null, samples)).toEqual([]);
  });

  it('measures a box across its middle', () => {
    expect(bboxSize([0, 59.5, 2, 60.5]).widthKm).toBeCloseTo(111.3, 0);
  });
});
