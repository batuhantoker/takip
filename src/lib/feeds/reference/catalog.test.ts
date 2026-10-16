import { describe, expect, it } from 'vitest';
import { REFERENCE_DATASETS, REFERENCE_GROUPS, REFERENCE_LAYER_DEFAULTS, referenceDataset, tierAt, type ReferenceDataset } from './catalog';

const datasets = REFERENCE_DATASETS as readonly ReferenceDataset[];

describe('reference catalog', () => {
  it('gives every dataset a unique id and a unique ref_ layer key', () => {
    expect(new Set(datasets.map(d => d.id)).size).toBe(datasets.length);
    expect(new Set(datasets.map(d => d.key)).size).toBe(datasets.length);
    for (const d of datasets) expect(d.key).toMatch(/^ref_[a-z0-9_]+$/);
  });

  it('uses ids that are safe as file names', () => {
    for (const d of datasets) expect(d.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('defaults every layer to off, so saved layer choices can be restored for each', () => {
    expect(Object.keys(REFERENCE_LAYER_DEFAULTS).sort()).toEqual(datasets.map(d => d.key).sort());
    expect(Object.values(REFERENCE_LAYER_DEFAULTS).every(v => v === false)).toBe(true);
  });

  it('puts every dataset in a known group and leaves no group empty', () => {
    const groups = new Set(REFERENCE_GROUPS.map(g => g.id));
    for (const d of datasets) expect(groups.has(d.group)).toBe(true);
    for (const g of REFERENCE_GROUPS) expect(datasets.some(d => d.group === g.id)).toBe(true);
  });

  it('keeps tiers in ascending order above the dataset minZoom', () => {
    for (const d of datasets) {
      const zooms = (d.tiers ?? []).map(t => t.belowZoom);
      expect(zooms).toEqual([...zooms].sort((a, b) => a - b));
      for (const z of zooms) expect(z).toBeGreaterThan(d.minZoom);
    }
  });

  it('only clips line datasets', () => {
    for (const d of datasets) if (d.clip) expect(d.geometry).toBe('line');
  });

  it('does not serve the unverified community military KML', () => {
    expect(datasets.some(d => /community|kml/i.test(d.id))).toBe(false);
  });
});

describe('tierAt', () => {
  const highways = referenceDataset('highway-planning-network')!;

  it('serves only interstates and freeways when far out, then adds arterials, then everything', () => {
    expect(tierAt(highways, 8)?.values).toEqual([1, 2]);
    expect(tierAt(highways, 10)?.values).toEqual([1, 2, 3]);
    expect(tierAt(highways, 11)).toBeUndefined();
  });

  it('applies no filter to datasets without tiers', () => {
    expect(tierAt(referenceDataset('dams')!, 7)).toBeUndefined();
  });

  it('returns undefined for an unknown id', () => {
    expect(referenceDataset('../etc/passwd')).toBeUndefined();
  });
});
