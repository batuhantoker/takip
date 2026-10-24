import { describe, expect, it } from 'vitest';
import { fallbacks, MAP_LAYER_SECTIONS, type Entitlements } from '@takip/core/entitlements';
import { LAYER_GROUPS } from '@/components/panels/layers/layer-groups';
import { closedLayerKeys, layerSection, sectionTitle, withoutClosed } from './layer-gates';
import { groupSections, OTHER_SECTION_ID } from './layer-sections';

const plan = (overrides: Partial<Entitlements> = {}): Entitlements => ({ ...fallbacks(), ...overrides });

describe('plan sections', () => {
  it('match the Layers panel sections one to one, Other aside', () => {
    const shown = groupSections(LAYER_GROUPS).map(s => s.id).filter(id => id !== OTHER_SECTION_ID);
    expect([...shown].sort()).toEqual([...MAP_LAYER_SECTIONS].sort());
  });

  it('place layers by their group and leave display toggles out', () => {
    expect(layerSection('flights')).toBe('air');
    expect(layerSection('maritime')).toBe('sea');
    expect(layerSection('cctv_previews')).toBe('cameras');
    expect(layerSection('gdelt_events')).toBe('conflict');
    expect(layerSection('day_night')).toBeUndefined();
    expect(sectionTitle('weather')).toBe('Weather & hazards');
  });
});

describe('closedLayerKeys', () => {
  it('is empty when every section is open, as it is by default', () => {
    expect(closedLayerKeys(plan()).size).toBe(0);
  });

  it('closes every layer of a closed section, sub-layers included', () => {
    const closed = closedLayerKeys(plan({ 'map.layers.air': false, 'map.layers.cameras': false }));
    expect(closed).toContain('flights');
    expect(closed).toContain('military');
    expect(closed).toContain('cctv');
    expect(closed).toContain('cctv_previews');
    expect(closed).not.toContain('maritime');
  });

  it('keeps GDELT with Conflict, though it sits under Live News', () => {
    expect(closedLayerKeys(plan({ 'map.layers.conflict': false }))).toContain('gdelt_events');
    expect(closedLayerKeys(plan({ 'map.layers.cameras': false }))).not.toContain('gdelt_events');
  });
});

describe('withoutClosed', () => {
  it('turns closed layers off and keeps the object when there is nothing to change', () => {
    const layers = { flights: true, maritime: true, cctv: false };
    expect(withoutClosed(layers, new Set(['flights']))).toEqual({ flights: false, maritime: true, cctv: false });
    expect(withoutClosed(layers, new Set(['cctv']))).toBe(layers);
  });
});
